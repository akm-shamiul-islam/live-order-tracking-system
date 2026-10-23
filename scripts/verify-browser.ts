import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  createIsolatedRuntime,
  unusedPort,
  io,
  type Socket,
} from '../backend/scripts/isolated-runtime.ts';
import { launchBrowser, waitFor, type Browser, type BrowserPage } from './lib/browser.ts';
import type {
  AuthResponse,
  AuthChallengeResponse,
  ClientToServerEvents,
  OrderDetails,
  ServerToClientEvents,
  UserSummary,
} from '../shared/src/index.ts';
import { responseJson } from './lib/json.ts';
import { checkPasswordVisibility } from './lib/password-controls.ts';

interface ApiOptions {
  token?: string | null;
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
}

interface BrowserSession {
  token: string | null;
  user: UserSummary | null;
}

type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));
const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const proxyPort = await unusedPort();
const proxyOrigin = `http://127.0.0.1:${proxyPort}`;
const runtime = await createIsolatedRuntime({
  count: 12,
  serveFrontend: true,
  extraOrigins: [proxyOrigin],
});
const checks: string[] = [];
let browser: Browser | undefined;
let cleanupPage: BrowserPage | undefined;
let vite: ChildProcess | undefined;
const sockets: AppSocket[] = [];
const directory = await mkdtemp(join(tmpdir(), 'ktd-browser-check-'));
const pass = (name: string) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
try {
  let app = await runtime.start();
  async function api<T = unknown>(path: string, { token, method = 'GET', body }: ApiOptions = {}) {
    const response = await fetch(app.base + '/api' + path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await responseJson<T>(response) };
  }
  browser = await launchBrowser();
  const page = await browser.page(app.base + '/orders');
  cleanupPage = page;
  const exceptions: string[] = [];
  page.on('Runtime.exceptionThrown', (event) => {
    const details = event.exceptionDetails;
    exceptions.push(details.exception?.description || details.text);
  });
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const evaluate = <T = unknown>(expression: string) => page.evaluate<T>(expression);
  const interceptionFailures: string[] = [];
  let failNextRequest = false;
  page.on('Fetch.requestPaused', (event) => {
    void (async () => {
      if (!failNextRequest) {
        await page.send('Fetch.continueRequest', { requestId: event.requestId });
        return;
      }
      failNextRequest = false;
      await page.send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'Failed' });
      await page.send('Fetch.disable');
    })().catch((error: unknown) =>
      interceptionFailures.push(error instanceof Error ? error.message : String(error)),
    );
  });
  async function dropNext(path: string, requestStage: 'Request' | 'Response') {
    failNextRequest = true;
    await page.send('Fetch.enable', {
      patterns: [{ urlPattern: app.base + path, requestStage }],
    });
  }
  const has = (text: string) =>
    evaluate<boolean>(
      `Boolean(document.querySelector('main')?.textContent.includes(${JSON.stringify(text)}))`,
    );
  const waitText = (text: string) => waitFor(() => has(text), text);
  const usesFullContentWidth = () =>
    evaluate(
      '(()=>{const main=document.querySelector("main");const content=main.querySelector(":scope > div");const css=getComputedStyle(main);return Math.abs(content.getBoundingClientRect().width-(main.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)))<2})()',
    );
  async function goto(path: string, text?: string) {
    await page.send('Page.navigate', { url: app.base + path });
    if (text) await waitText(text);
  }
  async function click(selector: string) {
    await waitFor(
      () =>
        evaluate(
          `(()=>{const target=document.querySelector(${JSON.stringify(selector)});return Boolean(target&&!target.disabled)})()`,
        ),
      'Clickable control',
    );
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  }
  async function clickText(text: string, selector = 'button') {
    await waitFor(
      () =>
        evaluate(
          `Boolean([...document.querySelectorAll(${JSON.stringify(selector)})].find(element=>element.textContent.trim()===${JSON.stringify(text)}&&!element.disabled))`,
        ),
      `Clickable ${text}`,
    );
    await evaluate(
      `[...document.querySelectorAll(${JSON.stringify(selector)})].find(element=>element.textContent.trim()===${JSON.stringify(text)}&&!element.disabled).click()`,
    );
  }
  async function openNavigation() {
    if (
      await evaluate(
        'document.querySelector(\'header button[aria-controls="site-navigation"]\')?.getAttribute("aria-expanded") !== "true"',
      )
    )
      await click('header button[aria-controls="site-navigation"]');
  }
  async function input(selector: string, value: string) {
    await evaluate(
      `(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw Error('Field not found');const prototype=element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  }
  async function select(label: string, value: string) {
    await click(`button[role="combobox"][aria-label="${label}"]`);
    await clickText(value, '[role="option"]');
  }
  async function screenshot(name: string) {
    const result = await page.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await writeFile(join(directory, `${name}.png`), Buffer.from(result.data, 'base64'));
  }
  async function hover(selector: string) {
    const point = await evaluate<{ x: number; y: number }>(
      `(()=>{const rect=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2}})()`,
    );
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  }
  const session = () =>
    evaluate<BrowserSession>(
      `({token:localStorage.getItem('ktd_token'),user:JSON.parse(localStorage.getItem('ktd_user')||'null')})`,
    );
  async function logout() {
    const before = await session();
    await clickText('Sign Out', 'header button');
    await waitFor(() => evaluate('!localStorage.getItem("ktd_token")'), 'Signed out browser');
    await waitFor(
      async () => (await api('/auth/me', { token: before.token })).status === 401,
      'Server session revocation',
    );
  }
  async function login(email: string, password: string) {
    await goto('/account', 'Welcome Back');
    await input('#customer-login-email', email);
    await input('#customer-login-password', password);
    await checkPasswordVisibility(page, 'customer-login-password');
    await clickText('Sign In');
    await waitFor(
      () =>
        evaluate(
          'Boolean(document.querySelector("#email-otp-code") || localStorage.getItem("ktd_token"))',
        ),
      'Sign-in challenge or authenticated session',
    );
    if (await evaluate('Boolean(document.querySelector("#email-otp-code"))')) {
      const code = await runtime.takeOtp(email);
      await input('#email-otp-code', code);
      await clickText('Verify and Sign In');
    }
    await waitFor(async () => Boolean((await session()).user), 'Signed-in account');
  }

  await waitText('Sign In to Continue');
  assert.equal(
    await evaluate(
      'document.querySelector(\'header button[aria-controls="site-navigation"]\').getAttribute("aria-expanded")',
    ),
    'true',
  );
  await waitFor(
    () => evaluate('localStorage.getItem("kitchentodoor.navigation.open") === "true"'),
    'Default open drawer preference',
  );
  await goto('/orders', 'Sign In to Continue');
  assert.equal(
    await evaluate(
      'document.querySelector(\'header button[aria-controls="site-navigation"]\').getAttribute("aria-expanded")',
    ),
    'true',
  );
  assert.deepEqual(
    await evaluate(
      `[...document.querySelectorAll('#site-navigation a')].map(element=>element.getAttribute('href')).filter(href=>['/users','/dispatch','/courier','/orders','/tracking'].includes(href))`,
    ),
    [],
  );
  await click('[aria-label="Close navigation drawer"]');
  await waitFor(
    () => evaluate('localStorage.getItem("kitchentodoor.navigation.open") === "false"'),
    'Closed drawer preference',
  );
  pass('Guest pages and protected drawer links require sign-in');

  await goto('/', 'Made fresh.');
  assert.equal(
    await evaluate(
      'document.querySelector(\'header button[aria-controls="site-navigation"]\').getAttribute("aria-expanded")',
    ),
    'false',
  );
  assert.equal(await evaluate('document.querySelectorAll("main article").length'), 8);
  assert.equal(
    await evaluate(
      'document.querySelector(\'nav[aria-label="Breadcrumb"] [aria-current="page"]\').textContent.trim()',
    ),
    'Food Menu',
  );
  await select('Items Per Page', '16');
  await waitFor(
    () => evaluate('document.querySelectorAll("main article").length === 16'),
    'Sixteen menu Items Per Page',
  );
  assert.equal(await evaluate('new URL(location.href).searchParams.get("size")'), '16');
  await click('button[role="combobox"][aria-label="Items Per Page"]');
  assert.deepEqual(
    await evaluate(
      '[...document.querySelectorAll("[role=option]")].map(element=>element.textContent.trim())',
    ),
    ['8', '16', '32', '60'],
  );
  await clickText('8', '[role=option]');
  await goto('/', 'Made fresh.');
  await evaluate(
    'document.querySelector("main article:last-child").scrollIntoView({block:"center"})',
  );
  await waitFor(
    () =>
      evaluate(
        '(()=>{const card=document.querySelector("main article:last-child");const image=card.querySelector("img");return image.complete&&image.naturalWidth>0&&card.querySelector("button").getClientRects().length>0})()',
      ),
    'Offscreen menu cards render and load when scrolled into view',
  );
  await evaluate('scrollTo({top:0,behavior:"instant"})');
  pass(
    'Drawer defaults open and persists both states; breadcrumbs and menu page sizes match navigation',
  );

  await evaluate(`(()=>{
    window.ktdNativePageTransition=document.startViewTransition;
    window.ktdPageTransitions=[];
    window.ktdPageHeader=document.querySelector('header');
    window.ktdPageDrawer=document.querySelector('.navigation-sidebar');
    document.startViewTransition=function(...args){
      const transition=window.ktdNativePageTransition.apply(this,args);
      const result={animations:[],finished:false};
      window.ktdPageTransitions.push(result);
      transition.ready.then(()=>{
        result.animations=document.getAnimations()
          .filter(animation=>animation.animationName?.startsWith('page-fade-'))
          .map(animation=>({name:animation.animationName,duration:animation.effect.getTiming().duration}));
      },error=>{result.skipped=error.message});
      transition.finished.then(()=>{result.finished=true},()=>{result.finished=true});
      return transition;
    };
  })()`);
  await openNavigation();
  await click('#site-navigation a[href="/account"]');
  await waitText('Welcome Back');
  await waitFor(
    () =>
      evaluate(
        'window.ktdPageTransitions.some(result=>result.animations.some(animation=>animation.name==="page-fade-in"&&animation.duration>0)&&result.animations.some(animation=>animation.name==="page-fade-out"&&animation.duration>0))',
      ),
    'Native page enter and exit animations',
  );
  assert.equal(
    await evaluate(
      'window.ktdPageHeader===document.querySelector("header")&&window.ktdPageDrawer===document.querySelector(".navigation-sidebar")',
    ),
    true,
  );
  const waitForPageTransitions = () =>
    waitFor(
      () => evaluate('window.ktdPageTransitions.every(result=>result.finished)'),
      'Page transitions finish',
    );
  await waitForPageTransitions();
  await click('#site-navigation a[href="/"]');
  await waitText('Made fresh.');
  await waitForPageTransitions();
  await evaluate('history.back()');
  await waitText('Welcome Back');
  await waitForPageTransitions();
  await evaluate('history.forward()');
  await waitText('Made fresh.');
  await waitForPageTransitions();
  await evaluate('window.ktdPageTransitions=[]');
  await select('Items Per Page', '16');
  await waitFor(
    () => evaluate('document.querySelectorAll("main article").length===16'),
    'Menu filter update',
  );
  assert.equal(await evaluate('window.ktdPageTransitions.length'), 0);
  await select('Items Per Page', '8');
  await waitFor(
    () => evaluate('document.querySelectorAll("main article").length===8'),
    'Default menu page size',
  );
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await click('#site-navigation a[href="/account"]');
  await waitText('Welcome Back');
  await waitForPageTransitions();
  assert.equal(
    await evaluate(
      'window.ktdPageTransitions.some(result=>result.animations.some(animation=>animation.duration>0))',
    ),
    false,
  );
  await evaluate('document.startViewTransition=undefined');
  await click('#site-navigation a[href="/"]');
  await waitText('Made fresh.');
  await evaluate(`(()=>{
    document.startViewTransition=window.ktdNativePageTransition;
    delete window.ktdNativePageTransition;
    delete window.ktdPageTransitions;
    delete window.ktdPageHeader;
    delete window.ktdPageDrawer;
  })()`);
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });
  await click('[aria-label="Close navigation drawer"]');
  await waitFor(
    () => evaluate('document.querySelector(".app-content").getAnimations().length===0'),
    'Closed navigation after transition checks',
  );
  pass(
    'Drawer pages crossfade with a stable shell; history, filters, reduced motion and unsupported browsers remain usable',
  );

  // Do not wait for snapshot animations between these page changes. The app
  // must handle interrupted native transitions without suppressing real errors.
  await openNavigation();
  await click('#site-navigation a[href="/account"]');
  await waitText('Welcome Back');
  await clickText('Create an Account', 'main a');
  await waitText('Create Your Account');
  await click('#site-navigation a[href="/"]');
  await waitText('Made fresh.');
  await click('[aria-label="Close navigation drawer"]');

  await evaluate(`(()=>{
    window.ktdAppearanceNative=document.startViewTransition;
    window.ktdAppearanceTransitions=[];
    document.startViewTransition=function(options){
      const transition=window.ktdAppearanceNative.call(this,options);
      const record={types:options.types??[],animations:[],finished:false};
      window.ktdAppearanceTransitions.push(record);
      transition.ready.then(()=>{record.animations=document.getAnimations().filter(a=>a.animationName?.startsWith('appearance-fade-')).map(a=>a.animationName)},()=>{});
      transition.finished.then(()=>{record.finished=true},()=>{record.finished=true});
      return transition;
    };
  })()`);
  await click('button[aria-label="Switch to Dark Mode"]');
  await waitFor(
    () => evaluate('document.documentElement.classList.contains("dark")'),
    'Dark theme',
  );
  await waitFor(
    () =>
      evaluate(
        'window.ktdAppearanceTransitions.some(t=>t.types.includes("theme-change")&&t.animations.includes("appearance-fade-in")&&t.animations.includes("appearance-fade-out"))',
      ),
    'Whole-interface theme crossfade',
  );
  await waitFor(
    () => evaluate('window.ktdAppearanceTransitions.every(t=>t.finished)'),
    'Theme transition finishes',
  );
  await click('button[aria-label="Switch to Light Mode"]');
  await waitFor(
    () => evaluate('!document.documentElement.classList.contains("dark")'),
    'Light theme',
  );
  await openNavigation();
  await click('#site-navigation a[href="/account"]');
  await waitText('Welcome Back');
  await clickText('Create an Account', 'main a');
  await waitText('Create Your Account');
  await input('#register-name', 'Preserved Language Draft');
  await select('Language', 'JA');
  await waitFor(() => evaluate('document.documentElement.lang === "ja"'), 'Japanese language');
  await waitText('アカウントの新規登録');
  await waitFor(
    () =>
      evaluate(
        'window.ktdAppearanceTransitions.some(t=>t.types.includes("language-change")&&t.animations.includes("appearance-fade-in")&&t.animations.includes("appearance-fade-out"))',
      ),
    'Whole-interface language crossfade',
  );
  assert.equal(
    await evaluate('document.querySelector("#register-name").value'),
    'Preserved Language Draft',
  );
  assert.equal(await evaluate('localStorage.getItem("ktd_language")'), 'ja');
  assert.equal(
    await evaluate(
      `Boolean(document.querySelector('#site-navigation a[href="/"]')?.textContent.includes("料理を注文"))`,
    ),
    true,
  );
  await waitFor(
    () => evaluate('window.ktdAppearanceTransitions.every(t=>t.finished)'),
    'Japanese appearance settles before form interaction',
  );
  await clickText('アカウントを作成');
  await waitText('有効なメールアドレスを入力してください');
  await screenshot('registration-japanese');
  await select('言語', 'EN');
  await waitText('Create Your Account');
  assert.equal(
    await evaluate('document.querySelector("#register-name").value'),
    'Preserved Language Draft',
  );
  await click('#site-navigation a[href="/"]');
  await waitText('Made fresh.');
  await click('[aria-label="Close navigation drawer"]');
  await waitFor(
    () => evaluate('window.ktdAppearanceTransitions.every(t=>t.finished)'),
    'Appearance transitions finish',
  );
  await evaluate(
    'document.startViewTransition=window.ktdAppearanceNative; delete window.ktdAppearanceNative; delete window.ktdAppearanceTransitions',
  );
  pass(
    'Theme/language crossfades, Japanese forms/navigation, inline validation and draft preservation',
  );

  // Earlier synthetic clicks do not move the pointer or emit mouseleave.
  // Reproduce a real pointer leaving the theme trigger before tabbing back.
  await hover('button[aria-label="Switch to Dark Mode"]');
  await hover('button[aria-label^="View cart"]');
  await waitFor(
    () =>
      evaluate(
        'Boolean(document.querySelector("[role=tooltip]")?.textContent.includes("View cart"))',
      ),
    'Custom cart tooltip',
  );
  assert.equal(
    await evaluate(
      '(()=>{const r=document.querySelector("[role=tooltip]").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()',
    ),
    true,
  );
  await evaluate(`document.querySelector('button[aria-label^="View cart"]').focus()`);
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9,
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9,
  });
  await waitFor(
    () =>
      evaluate(
        'Boolean(document.querySelector("[role=tooltip]")?.textContent.includes("Switch to Dark Mode"))',
      ),
    'Keyboard theme tooltip',
  );
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1 });
  await evaluate('document.activeElement.blur()');
  await waitFor(() => evaluate('!document.querySelector("[role=tooltip]")'), 'Tooltip dismissal');
  pass('Themed cart/theme tooltips support hover, keyboard focus, Escape and viewport boundaries');

  await click('button[aria-label^="Add "]');
  await click('header button[aria-label^="View cart"]');
  await waitFor(() => evaluate('Boolean(document.querySelector("dialog[open]"))'), 'Cart dialog');
  await clickText('Proceed to Checkout');
  await waitText('Welcome Back');
  await clickText('Create an Account', 'a');
  await waitText('Create Your Account');
  await clickText('Create Account');
  await waitFor(
    () => evaluate('document.querySelectorAll("input[aria-invalid=true]").length >= 4'),
    'Registration field validation',
  );
  assert.equal(await evaluate('document.activeElement?.id'), 'register-name');
  await waitFor(
    () =>
      evaluate(
        'getComputedStyle(document.querySelector("#register-name")).borderTopColor === "rgb(244, 63, 94)"',
      ),
    'Red validation border after its color transition',
  );
  const email = 'browser-customer@example.test';
  const nextEmail = 'browser-courier@example.test';
  const savedAddress = '45 Registration Avenue, Apt 2\nTest City 10001';
  for (const [field, value] of Object.entries({
    name: 'Browser Customer',
    email,
    phone: '555-1234567',
    address: '1234',
    password: app.password,
    confirmPassword: app.password,
  }))
    await input(`#register-${field}`, value);
  await clickText('Create Account');
  await waitFor(
    () =>
      evaluate(
        'document.querySelector("#register-address").getAttribute("aria-invalid") === "true"',
      ),
    'Registration address field validation',
  );
  assert.equal(await evaluate('document.activeElement?.id'), 'register-address');
  assert.equal(await evaluate('document.querySelector("#register-address").required'), false);
  await waitFor(
    () =>
      evaluate(
        'getComputedStyle(document.querySelector("#register-address")).borderTopColor === "rgb(244, 63, 94)"',
      ),
    'Red registration address border',
  );
  await input('#register-address', savedAddress);
  await checkPasswordVisibility(page, 'register-password');
  await checkPasswordVisibility(page, 'register-confirmPassword');
  await evaluate('scrollTo({top:0,behavior:"instant"})');
  await screenshot('registration-desktop');
  await clickText('Create Account');
  await waitFor(
    () => evaluate('Boolean(document.querySelector("#email-otp-code"))'),
    'Registration email verification form',
  );
  assert(
    await evaluate(
      'document.body.textContent.includes("Code expires in")&&document.body.textContent.includes("Request another code in")&&[...document.querySelectorAll("button")].some(button=>button.textContent.includes("Resend Verification Code")&&button.disabled)',
    ),
    'Registration shows OTP expiry and resend countdown',
  );
  const registrationCode = await runtime.takeOtp(email);
  await input('#email-otp-code', registrationCode);
  await clickText('Verify Email');
  await waitFor(async () => (await session()).user?.role === 'CUSTOMER', 'Default customer role');
  await waitFor(() => evaluate('location.pathname === "/"'), 'Checkout return location');
  await click('header button[aria-label^="View cart"]');
  await clickText('Proceed to Checkout');
  await waitFor(
    () => evaluate('Boolean(document.querySelector("#checkout-address"))'),
    'Checkout form',
  );
  assert.equal(
    await evaluate('document.querySelector("#checkout-name").value'),
    'Browser Customer',
  );
  assert.equal(await evaluate('document.querySelector("#checkout-phone").value'), '555-1234567');
  assert.equal(await evaluate('document.querySelector("#checkout-address").value'), savedAddress);
  await screenshot('checkout-saved-address');
  await input('#checkout-name', 'Delivery Recipient');
  await input('#checkout-phone', '555-7654321');
  await input('#checkout-address', '123 Browser Test Street');
  await input('#checkout-note', 'n'.repeat(501));
  await clickText('Confirm Order');
  await waitFor(
    () =>
      evaluate(
        `(()=>{const input=document.querySelector('#checkout-note');const error=document.querySelector('#checkout-note-error');return input.getAttribute('aria-invalid')==='true'&&document.activeElement===input&&error?.textContent.includes('Use at most 500 characters')&&getComputedStyle(input).borderColor==='rgb(244, 63, 94)'})()`,
      ),
    'Checkout note validation and red field border',
  );
  await input('#checkout-note', 'Ring the doorbell on arrival.');
  pass('Checkout notes use shared limits, inline field errors and focus on invalid input');
  await page.send('Browser.setPermission', {
    permission: { name: 'geolocation' },
    setting: 'granted',
    origin: app.base,
  });
  await page.send('Emulation.setGeolocationOverride', {
    latitude: 40.713,
    longitude: -74.005,
    accuracy: 5,
  });
  await clickText('Use My Current Location');
  await waitFor(
    () =>
      evaluate(
        'Boolean(document.querySelector("dialog[open]")?.textContent.includes("Map pin attached"))',
      ),
    'Customer location pin',
  );
  const deliveryAddress = '99 Edited Delivery Street\nTest City 20002';
  await input('#checkout-address', deliveryAddress);
  assert.equal(
    await evaluate(
      'document.querySelector("dialog[open]").textContent.includes("Map pin attached")',
    ),
    false,
  );
  // A late location response must not restore a pin for an address that was edited.
  await evaluate(`(()=>{
    const geo=navigator.geolocation;
    window.ktdOriginalLocation=geo.getCurrentPosition;
    geo.getCurrentPosition=(success)=>{window.ktdPendingLocation=success};
  })()`);
  await clickText('Use My Current Location');
  await waitFor(
    () => evaluate('typeof window.ktdPendingLocation === "function"'),
    'Pending location request',
  );
  await input('#checkout-address', `${deliveryAddress} `);
  await evaluate(`(()=>{
    navigator.geolocation.getCurrentPosition=window.ktdOriginalLocation;
    window.ktdPendingLocation({coords:{latitude:40.713,longitude:-74.005}});
    delete window.ktdOriginalLocation;
    delete window.ktdPendingLocation;
  })()`);
  assert.equal(
    await evaluate(
      'document.querySelector("dialog[open]").textContent.includes("Map pin attached")',
    ),
    false,
  );
  await clickText('Use My Current Location');
  await waitFor(
    () =>
      evaluate('document.querySelector("dialog[open]").textContent.includes("Map pin attached")'),
    'Location pin reattached to the updated address',
  );
  // Drop the response after the API has committed, then retry the same checkout.
  await dropNext('/api/orders', 'Response');
  await clickText('Confirm Order');
  await waitFor(
    () =>
      evaluate(
        'document.querySelector("dialog[open]")?.textContent.includes("Check your connection")',
      ),
    'Lost checkout response feedback',
  );
  await clickText('Confirm Order');
  await waitText('Order Details');
  let customer = await session();
  assert(customer.token, 'Checkout requires a signed-in customer');
  const own = await api<{ orders: OrderDetails[] }>('/orders/my-orders?page=1&limit=100', {
    token: customer.token,
  });
  assert.equal(own.status, 200);
  assert.equal(own.body.orders.length, 1);
  pass('A lost checkout response can be retried without creating a duplicate order');
  const order = own.body.orders[0];
  assert(order, 'Checkout must create the customer order');
  assert.deepEqual(order.customer, {
    name: 'Delivery Recipient',
    phone: '555-7654321',
    address: deliveryAddress,
  });
  const savedProfile = await api<UserSummary>('/auth/me', { token: customer.token });
  assert.equal(savedProfile.status, 200);
  assert.equal(savedProfile.body.address, savedAddress);
  assert.equal(savedProfile.body.name, 'Browser Customer');
  assert.equal(savedProfile.body.phone, '555-1234567');
  await select('Language', 'JA');
  await waitFor(async () => (await session()).user?.language === 'ja', 'Account language saved');
  const languageProfile = await api<UserSummary>('/auth/me', { token: customer.token });
  assert.equal(languageProfile.body.language, 'ja');
  const languageToken = (await session()).token;
  await clickText('ログアウト', 'header button');
  await waitFor(
    async () => (await api('/auth/me', { token: languageToken })).status === 401,
    'Japanese sign out',
  );
  await select('言語', 'EN');
  await waitFor(
    () => evaluate('document.documentElement.lang === "en"'),
    'Guest English preference',
  );
  await login(email, app.password);
  await waitFor(
    () => evaluate('document.documentElement.lang === "ja"'),
    'Saved account language restored on login',
  );
  await goto('/orders', '注文履歴');
  await waitText(order.orderNumber);
  await select('言語', 'EN');
  await waitFor(async () => (await session()).user?.language === 'en', 'Return account to English');
  customer = await session();
  assert(customer.token);
  pass(
    'A language preference persists in MongoDB and returns after sign-out, guest changes and sign-in',
  );
  pass(
    'Registration saves an optional address; checkout prefills contact details, accepts edits and clears stale map pins',
  );
  assert.equal(order.deliveryLocationProvided, true);
  assert.equal(await has(order.orderNumber), true);
  assert.equal(await has('Truffle Smoke Burger'), true);
  await goto('/orders', 'My Order History');
  await waitText(order.orderNumber);
  assert.equal(await usesFullContentWidth(), true);
  assert.equal(
    await evaluate(
      'document.querySelector(\'nav[aria-label="Breadcrumb"] [aria-current="page"]\').textContent.trim()',
    ),
    'My Orders',
  );
  const expired = runtime.expireAccessToken(customer.token);
  await evaluate(`localStorage.setItem('ktd_token',${JSON.stringify(expired)})`);
  await goto('/orders', 'My Order History');
  await waitText(order.orderNumber);
  await waitFor(async () => {
    const current = await session();
    return Boolean(current.token && current.token !== expired);
  }, 'Rotated session after access expiry');
  pass('Expired access token refreshes through the real HttpOnly browser cookie');
  const fullWidth = await evaluate<number>(
    'document.querySelector("main").getBoundingClientRect().width',
  );
  await openNavigation();
  assert.equal(
    await evaluate(`Boolean(document.querySelector('#site-navigation a[href="/users"]'))`),
    false,
  );
  await waitFor(
    async () =>
      (await evaluate<number>('document.querySelector("main").getBoundingClientRect().width')) <
      fullWidth - 250,
    'Desktop drawer reserves content width',
  );
  const narrowWidth = await evaluate<number>(
    'document.querySelector("main").getBoundingClientRect().width',
  );
  await click('[aria-label="Close navigation drawer"]');
  await waitFor(
    async () =>
      (await evaluate<number>('document.querySelector("main").getBoundingClientRect().width')) >
      narrowWidth + 200,
    'Desktop drawer restores content width',
  );
  pass(
    'Customer registration, red field errors, cart continuity, checkout, location pin and owned history',
  );

  const beforeFailedLogout = await session();
  await dropNext('/api/auth/logout', 'Request');
  await clickText('Sign Out', 'header button');
  await waitFor(
    () =>
      evaluate('document.body.textContent.includes("We could not sign out your other sessions")'),
    'Failed server sign-out warning',
  );
  assert.equal((await session()).token, null);
  assert.equal((await api('/auth/me', { token: beforeFailedLogout.token })).status, 200);
  await clickText('Retry Sign Out');
  await waitFor(
    async () => (await api('/auth/me', { token: beforeFailedLogout.token })).status === 401,
    'Retried server session revocation',
  );
  await waitFor(
    () =>
      evaluate('!document.body.textContent.includes("We could not sign out your other sessions")'),
    'Revocation warning cleared',
  );
  assert.deepEqual(interceptionFailures, []);
  pass('Failed server sign-out clears local access, displays a warning and retries revocation');
  await login('dispatcher@example.test', app.password);
  await waitText('Kitchen Dispatch Station');
  await openNavigation();
  await click('#site-navigation a[href="/users"]');
  await waitText('Manage customer accounts');
  await input('#users-search', email);
  await clickText('Search');
  await waitText(email);
  await evaluate(
    `(()=>{const row=[...document.querySelectorAll('tbody tr')].find(element=>element.textContent.includes(${JSON.stringify(email)}));row.querySelector('button').click()})()`,
  );
  await waitFor(
    () => evaluate('Boolean(document.querySelector("#edit-user-name"))'),
    'Admin editor',
  );
  await input('#edit-user-name', 'Browser Courier');
  await input('#edit-user-email', nextEmail);
  await select('User role', 'Courier');
  assert.equal(
    await evaluate('Boolean(document.querySelector("dialog input[type=checkbox]"))'),
    false,
  );
  await select('Account Status', 'Disabled');
  await select('Account Status', 'Active');
  assert.equal(
    await evaluate(
      '(()=>{const buttons=[...document.querySelectorAll("dialog button")].filter(b=>["Cancel","Save Changes"].includes(b.textContent.trim()));return buttons.length===2&&buttons.every(b=>getComputedStyle(b).transitionDuration.split(",").some(t=>parseFloat(t)>0))})()',
    ),
    true,
  );
  await clickText('Save Changes');
  await waitFor(() => evaluate('!document.querySelector("dialog[open]")'), 'Saved role editor');
  assert.equal((await api('/auth/me', { token: customer.token })).status, 401);
  await input('#users-search', nextEmail);
  await clickText('Search');
  await waitText(nextEmail);
  assert.equal(
    await evaluate(
      '(()=>{const table=document.querySelector("table");const headers=[...table.querySelectorAll("th")];const centered=["Phone","Role","Account","Actions"].map(label=>headers.findIndex(th=>th.textContent.trim()===label));return headers.every(th=>getComputedStyle(th).textAlign==="center")&&centered.every(index=>index>=0)&&[...table.querySelectorAll("tbody tr")].every(row=>centered.every(index=>getComputedStyle(row.cells[index]).textAlign==="center"))})()',
    ),
    true,
  );
  await screenshot('users-desktop');
  pass('Admin Users search, profile editing and courier promotion revoke the previous session');

  await logout();
  await login(nextEmail, app.password);
  await waitText('Available Deliveries');
  await waitText(order.orderNumber);
  assert.equal(await usesFullContentWidth(), true);
  await openNavigation();
  await waitFor(
    usesFullContentWidth,
    'Available Deliveries uses the remaining width with its drawer open',
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await waitFor(
    () => evaluate('document.querySelector(".app-content").getAnimations().length === 0'),
    'Desktop drawer settles at the narrower viewport',
  );
  assert.equal(
    await evaluate('document.documentElement.scrollWidth <= innerWidth'),
    true,
    'Available Deliveries must wrap its description when the open drawer leaves less room',
  );
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const links = await evaluate<string[]>(
    '[...document.querySelectorAll("#site-navigation a")].map(element=>element.getAttribute("href"))',
  );
  assert(
    links.includes('/courier') &&
      links.includes('/orders') &&
      !links.includes('/users') &&
      !links.includes('/dispatch'),
  );
  await click('[aria-label="Close navigation drawer"]');
  await waitFor(usesFullContentWidth, 'Available Deliveries expands when its drawer closes');
  assert.equal(
    await evaluate(
      '(()=>{const p=[...document.querySelectorAll("main p")].find(p=>p.textContent.includes("Request a delivery below."));const range=document.createRange();range.selectNodeContents(p);return range.getClientRects().length===1})()',
    ),
    true,
  );
  await waitFor(
    () => evaluate('document.querySelector(".app-content").getAnimations().length === 0'),
    'Desktop drawer finishes closing',
  );
  await screenshot('courier-desktop');
  await evaluate(
    `(()=>{const card=[...document.querySelectorAll('article')].find(element=>element.textContent.includes(${JSON.stringify(order.orderNumber)}));card.querySelector('button').click()})()`,
  );
  await waitText('Awaiting administrator approval');
  await goto('/orders', 'My Deliveries');
  assert.equal(await has(order.orderNumber), false);
  await goto('/dispatch', 'Access Restricted');
  pass('Couriers request delivery, cannot self-assign, and cannot open admin pages');

  await logout();
  await login('dispatcher@example.test', app.password);
  await goto(`/tracking/${order.id}`, 'Delivery Requests (1)');
  await click('[aria-label="Approve Browser Courier"]');
  await waitText('A courier is assigned');
  await logout();
  await login(nextEmail, app.password);
  await goto('/orders', 'My Deliveries');
  await waitText(order.orderNumber);
  await evaluate(
    `(()=>{const link=[...document.querySelectorAll('main a')].find(element=>element.getAttribute('aria-label')?.startsWith('Manage Delivery'));link.click()})()`,
  );
  await waitText('Update Status');
  for (const status of ['CONFIRMED', 'PREPARING', 'READY FOR PICKUP', 'OUT FOR DELIVERY']) {
    await select('Order Status', status);
    await clickText('Update Status');
    await waitFor(
      () =>
        evaluate(
          `document.querySelector('button[aria-label="Order Status"]')?.textContent.includes(${JSON.stringify(status)}) && [...document.querySelectorAll('button')].some(element=>element.textContent.trim()==='Update Status'&&element.disabled)`,
        ),
      'Updated delivery stage',
    );
  }
  await waitText('Share Your Location');
  // Chrome keeps the timestamp of an emulated sample, even with maximumAge: 0.
  // Supply a fresh device observation after the intervening account workflows.
  await page.send('Emulation.setGeolocationOverride', {
    latitude: 40.713,
    longitude: -74.005,
    accuracy: 5,
  });
  await clickText('Start Sharing');
  await waitText('Sharing is on.');
  const courier = await session();
  const located = await api<{ order: OrderDetails }>(`/orders/${order.id}`, {
    token: courier.token,
  });
  assert.equal(located.body.order.courierCoordinates?.lat, 40.713);
  await clickText('Stop Sharing');
  await waitText('Location sharing is off.');
  await select('Order Status', 'CANCELLED');
  await clickText('Update Status');
  await waitFor(
    () => evaluate('Boolean(document.querySelector("#cancel-order-reason"))'),
    'Cancellation modal',
  );
  await clickText('Cancel Order');
  await waitFor(
    () =>
      evaluate(
        'document.querySelector("#cancel-order-reason")?.getAttribute("aria-invalid") === "true"',
      ),
    'Required cancellation reason',
  );
  for (let index = 0; index < 8; index++) {
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
    });
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
    });
  }
  assert.equal(await evaluate('Boolean(document.activeElement?.closest("dialog[open]"))'), true);
  await input('#cancel-order-reason', 'Customer requested cancellation during delivery');
  await screenshot('cancellation-dialog');
  await clickText('Cancel Order');
  await waitText('This order is cancelled');
  await goto(`/tracking/${order.id}`, 'Customer requested cancellation during delivery');
  pass(
    'Admin approval, assigned-only history, sequential courier status changes, real GPS sharing and required cancellation reason',
  );

  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await goto('/courier', 'Available Deliveries');
  assert.equal(await usesFullContentWidth(), true);
  await openNavigation();
  await waitFor(
    () => evaluate('Boolean(document.querySelector("dialog.navigation-dialog[open]"))'),
    'Mobile drawer',
  );
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await waitFor(
    () => evaluate('!document.querySelector("dialog.navigation-dialog[open]")'),
    'Close mobile drawer',
  );
  await screenshot('courier-mobile');
  await goto('/', 'Made fresh.');
  if (await evaluate('!document.documentElement.classList.contains("dark")'))
    await click('button[aria-label="Switch to Dark Mode"]');
  await goto('/', 'Made fresh.');
  assert.equal(await evaluate('document.documentElement.classList.contains("dark")'), true);
  assert.equal(
    await evaluate('document.querySelector("meta[name=theme-color]").content'),
    '#020617',
  );
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.equal(
    await evaluate(
      '[...document.querySelectorAll("main img")].filter(image=>image.complete && image.naturalWidth === 0).length',
    ),
    0,
  );
  await screenshot('menu-dark-mobile');
  assert.deepEqual(exceptions, []);
  pass(
    'Responsive drawers, focus containment, reduced motion, dark menu, image loading and browser runtime',
  );

  const documentResponse = await fetch(app.base + '/users', { headers: { Accept: 'text/html' } });
  assert.equal(documentResponse.status, 200);
  const profileResponses = await Promise.all(
    ['/profile', '/notifications', '/notifications?status=PENDING&q=Test'].map((path) =>
      fetch(app.base + path, { headers: { Accept: 'text/html' } }),
    ),
  );
  for (const response of profileResponses) {
    assert.equal(response.status, 200, `Direct page loads must succeed: ${response.url}`);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/);
  }
  const csp = documentResponse.headers.get('content-security-policy');
  assert(csp, 'Production responses must include the content security policy');
  assert.match(csp, /script-src 'self'/);
  assert(!csp.includes('unsafe-eval'));
  assert.equal(
    (await fetch(app.base + '/api/unknown', { headers: { Accept: 'text/html' } })).status,
    404,
  );
  assert.equal((await fetch(app.base + '/missing.js')).status, 404);
  const html = await (await fetch(app.base)).text();
  const asset = (html.match(/src="([^"]+\.js)"/g) ?? [])
    .map((value) => value.slice(5, -1))
    .find((value) => value.startsWith('/assets/'));
  assert(asset, 'Production HTML must reference a built script');
  const compressed = await fetch(app.base + asset, { headers: { 'Accept-Encoding': 'br' } });
  assert.equal(compressed.headers.get('content-encoding'), 'br');
  assert.match(compressed.headers.get('cache-control') ?? '', /immutable/);
  pass('Production direct URLs, API/asset 404s, strict CSP and compressed immutable assets');

  const recoveryEmail = 'otp-recovery-browser@example.test';
  const originalPassword = 'Old-recovery#2026!';
  const registrationDevice = randomUUID();
  const registrationChallenge = await api<AuthChallengeResponse>('/auth/register', {
    method: 'POST',
    body: {
      name: 'OTP Recovery Browser',
      email: recoveryEmail,
      phone: '555-1234567',
      password: originalPassword,
    },
  });
  assert.equal(registrationChallenge.status, 201);
  const activationCode = await runtime.takeOtp(recoveryEmail);
  const activation = await api<AuthResponse>('/auth/email/verify', {
    method: 'POST',
    body: {
      challengeId: registrationChallenge.body.challengeId,
      code: activationCode,
      deviceId: registrationDevice,
    },
  });
  assert.equal(activation.status, 200);
  const resetRequest = await api<AuthChallengeResponse>('/auth/forgot-password', {
    method: 'POST',
    body: { email: recoveryEmail },
  });
  const missingResetRequest = await api<AuthChallengeResponse>('/auth/forgot-password', {
    method: 'POST',
    body: { email: 'missing-otp-browser@example.test' },
  });
  assert.equal(resetRequest.body.purpose, 'password_reset');
  assert.equal(missingResetRequest.body.purpose, 'password_reset');
  assert.deepEqual(
    Object.keys(resetRequest.body).sort(),
    Object.keys(missingResetRequest.body).sort(),
  );
  const resetCode = await runtime.takeOtp(recoveryEmail);
  const wrongCode = resetCode === '000000' ? '000001' : '000000';
  assert.equal(
    (
      await api('/auth/reset-password/verify', {
        method: 'POST',
        body: { challengeId: resetRequest.body.challengeId, code: wrongCode },
      })
    ).status,
    400,
  );
  const resetGrant = await api<{ resetToken: string }>('/auth/reset-password/verify', {
    method: 'POST',
    body: { challengeId: resetRequest.body.challengeId, code: resetCode },
  });
  assert.equal(resetGrant.status, 200);
  assert.match(resetGrant.body.resetToken, /^reset_[\w-]{43}$/);
  const changedPassword = 'New-recovery#2026!';
  assert.equal(
    (
      await api('/auth/reset-password', {
        method: 'POST',
        body: {
          token: resetGrant.body.resetToken,
          password: changedPassword,
          confirmPassword: changedPassword,
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (await api('/auth/me', { token: activation.body.accessToken })).status,
    401,
    'Password reset revokes existing sessions',
  );
  assert.equal(
    (
      await api<AuthChallengeResponse>('/auth/login', {
        method: 'POST',
        body: { email: recoveryEmail, password: originalPassword, deviceId: randomUUID() },
      })
    ).status,
    401,
  );
  const resetLoginDevice = randomUUID();
  const resetLogin = await api<AuthChallengeResponse>('/auth/login', {
    method: 'POST',
    body: { email: recoveryEmail, password: changedPassword, deviceId: resetLoginDevice },
  });
  assert.equal(resetLogin.body.purpose, 'new_device_login');
  const resetLoginCode = await runtime.takeOtp(recoveryEmail);
  assert.equal(
    (
      await api<AuthResponse>('/auth/login/verify', {
        method: 'POST',
        body: {
          challengeId: resetLogin.body.challengeId,
          code: resetLoginCode,
          deviceId: resetLoginDevice,
        },
      })
    ).status,
    200,
  );
  pass(
    'Email OTP activation, unknown-device sign-in, password reset, session revocation and non-enumerating reset responses',
  );

  await goto('/account/forgot', 'Reset Your Password');
  assert.equal(await evaluate('Boolean(document.querySelector("#forgot-email"))'), true);
  assert.equal(await evaluate('Boolean(document.querySelector("#reset-password"))'), false);
  assert.equal(await has('Send Verification Code'), true);
  await input('#forgot-email', recoveryEmail);
  await clickText('Send Verification Code');
  await waitFor(
    () => evaluate('Boolean(document.querySelector("#email-otp-code"))'),
    'Reset OTP form',
  );
  const browserResetCode = await runtime.takeOtp(recoveryEmail);
  await input('#email-otp-code', browserResetCode === '000000' ? '000001' : '000000');
  await clickText('Verify Code');
  await waitFor(
    () =>
      evaluate(
        'document.querySelector("#email-otp-code")?.getAttribute("aria-invalid") === "true" && Boolean(document.querySelector("#email-otp-code-error")?.textContent)',
      ),
    'Incorrect OTP has a linked inline field error',
  );
  await waitFor(
    () =>
      evaluate(
        'getComputedStyle(document.querySelector("#email-otp-code")).borderTopColor === "rgb(244, 63, 94)"',
      ),
    'Incorrect OTP uses the themed red field border after its transition',
  );
  await input('#email-otp-code', browserResetCode);
  await clickText('Verify Code');
  await waitFor(
    () =>
      evaluate(
        'location.pathname === "/account/reset" && Boolean(document.querySelector("#reset-password") && document.querySelector("#reset-confirmPassword"))',
      ),
    'Password reset form after OTP verification',
  );
  const browserChangedPassword = 'Browser-recovery#2026!';
  await input('#reset-password', browserChangedPassword);
  await input('#reset-confirmPassword', browserChangedPassword);
  await checkPasswordVisibility(page, 'reset-password');
  await checkPasswordVisibility(page, 'reset-confirmPassword');
  await clickText('Save New Password');
  await waitText('Your password has been changed. Sign in again with your new password.');
  await clickText('Request a New Code', 'a');
  await waitFor(
    () =>
      evaluate(
        'location.pathname === "/account/forgot" && Boolean(document.querySelector("#forgot-email")) && !document.querySelector("#reset-password")',
      ),
    'Restart recovery clears the previous reset grant and password form',
  );
  pass(
    'Forgot-password browser flow validates OTP inline, saves the password, and restarts with only the email field',
  );

  let viteLog = '';
  const viteCli = join(dirname(frontendRequire.resolve('vite/package.json')), 'bin/vite.js');
  vite = spawn(
    process.execPath,
    [viteCli, '--host', '127.0.0.1', '--port', String(proxyPort), '--strictPort'],
    {
      cwd: join(projectRoot, 'frontend'),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, API_PROXY_TARGET: app.base },
    },
  );
  if (!vite.stdout || !vite.stderr) throw new Error('Vite output pipes were not created.');
  vite.stdout.on('data', (data: Buffer) => {
    viteLog = (viteLog + data).slice(-10_000);
  });
  vite.stderr.on('data', (data: Buffer) => {
    viteLog = (viteLog + data).slice(-10_000);
  });
  await waitFor(async () => {
    try {
      return (await fetch(proxyOrigin + '/api/config')).ok;
    } catch {
      return false;
    }
  }, 'Private Vite proxy');
  const developmentHtml = await (await fetch(proxyOrigin)).text();
  assert.match(developmentHtml, /<script id="theme-init">/);
  assert(!developmentHtml.includes('<!-- theme-init -->'));
  const proxyDeviceId = randomUUID();
  const proxyLogin = await api<AuthChallengeResponse>('/auth/login', {
    method: 'POST',
    body: { email: 'dispatcher@example.test', password: app.password, deviceId: proxyDeviceId },
  });
  const proxyCode = await runtime.takeOtp('dispatcher@example.test');
  const proxyVerified = await api<AuthResponse>('/auth/login/verify', {
    method: 'POST',
    body: {
      challengeId: proxyLogin.body.challengeId,
      code: proxyCode,
      deviceId: proxyDeviceId,
    },
  });
  const proxyToken = proxyVerified.body.accessToken;
  async function connect(expectFailure = false) {
    const socket: AppSocket = io(proxyOrigin, {
      transports: ['websocket'],
      reconnection: false,
      auth: { token: proxyToken },
      extraHeaders: { Origin: proxyOrigin },
    });
    sockets.push(socket);
    await new Promise<void>((resolveReady, reject) => {
      const timer = setTimeout(() => reject(new Error('Private proxy socket timed out')), 6000);
      socket.once('authenticated', () => {
        clearTimeout(timer);
        if (expectFailure) reject(new Error('Expected backend outage'));
        else resolveReady();
      });
      socket.once('connect_error', () => {
        clearTimeout(timer);
        if (expectFailure) resolveReady();
        else reject(new Error('Private proxy connection failed'));
      });
    });
    return socket;
  }
  const connected = await connect();
  assert.equal((await connected.timeout(3000).emitWithAck('ping')).ok, true);
  connected.disconnect();
  const originalBase = app.base;
  const originalPort = Number(new URL(originalBase).port);
  await runtime.stop(originalBase);
  (await connect(true)).disconnect();
  (await connect(true)).disconnect();
  assert.equal((viteLog.match(/API .* is not reachable\./g) || []).length, 1);
  app = await runtime.start('fastify', { port: originalPort });
  const recovered = await connect();
  assert.equal((await recovered.timeout(3000).emitWithAck('ping')).ok, true);
  recovered.disconnect();
  assert.equal((await fetch(proxyOrigin + '/api/config')).status, 200);
  pass(
    'Vite WebSocket proxy gives one actionable outage warning and recovers after an API restart',
  );

  const measuredAt = new Date().toISOString();
  const output = join(projectRoot, `documentation/quality/browser-${measuredAt.slice(0, 10)}.json`);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(
    output,
    JSON.stringify(
      {
        measuredAt,
        chrome: browser.version,
        node: process.version,
        checks,
        method:
          'Compiled production app, isolated synthetic MongoDB, browser-driven forms and navigation, real API/Socket.IO, and an isolated Vite server restart test. No development database or existing dev server is used.',
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Saved ${checks.length} browser checks. Screenshots: ${directory}`);
} catch (error) {
  if (cleanupPage) {
    const notices = await cleanupPage
      .evaluate(
        `JSON.stringify([...document.querySelectorAll('main [role="alert"], main [role="status"]')].map(element=>element.textContent?.trim()).filter(Boolean))`,
      )
      .catch(() => undefined);
    if (typeof notices === 'string') console.log(`Browser notices: ${notices}`);
    const capture = await cleanupPage
      .send('Page.captureScreenshot', { format: 'png' })
      .catch(() => undefined);
    if (capture)
      await writeFile(join(directory, 'failure.png'), Buffer.from(capture.data, 'base64'));
    console.log(`Browser failure screenshot: ${join(directory, 'failure.png')}`);
  }
  throw error;
} finally {
  for (const socket of sockets) socket.disconnect();
  if (vite && vite.exitCode === null && vite.signalCode === null) {
    const exited = once(vite, 'exit');
    vite.kill();
    await exited;
  }
  await cleanupPage?.dispose().catch(() => undefined);
  await browser?.close();
  await runtime.close();
}
