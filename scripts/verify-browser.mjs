import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { createIsolatedRuntime, unusedPort } from './lib/isolated-runtime.mjs';
import { launchBrowser, waitFor } from './lib/browser.mjs';

const backendRequire = createRequire(new URL('../backend/package.json', import.meta.url));
const frontendRequire = createRequire(new URL('../frontend/package.json', import.meta.url));
const { io } = backendRequire('socket.io-client');
const proxyPort = await unusedPort();
const proxyOrigin = `http://127.0.0.1:${proxyPort}`;
const runtime = await createIsolatedRuntime({
  count: 12,
  serveFrontend: true,
  extraOrigins: [proxyOrigin],
});
const checks = [];
let browser;
let page;
let vite;
const sockets = [];
const directory = await mkdtemp(join(tmpdir(), 'ktd-browser-check-'));
const pass = (name) => {
  checks.push(name);
  console.log(`PASS ${name}`);
};
try {
  let app = await runtime.start();
  async function api(path, { token, method = 'GET', body } = {}) {
    const response = await fetch(app.base + '/api' + path, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  }
  browser = await launchBrowser();
  page = await browser.page(app.base + '/orders');
  const exceptions = [];
  page.on('Runtime.exceptionThrown', (event) => exceptions.push(event.exceptionDetails.text));
  await page.send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const evaluate = (expression) => page.evaluate(expression);
  const has = (text) =>
    evaluate(
      `Boolean(document.querySelector('main')?.textContent.includes(${JSON.stringify(text)}))`,
    );
  const waitText = (text) => waitFor(() => has(text), text);
  async function goto(path, text) {
    await page.send('Page.navigate', { url: app.base + path });
    if (text) await waitText(text);
  }
  async function click(selector) {
    await waitFor(
      () =>
        evaluate(
          `(()=>{const target=document.querySelector(${JSON.stringify(selector)});return Boolean(target&&!target.disabled)})()`,
        ),
      'Clickable control',
    );
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  }
  async function clickText(text, selector = 'button') {
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
  async function input(selector, value) {
    await evaluate(
      `(()=>{const element=document.querySelector(${JSON.stringify(selector)});if(!element)throw Error('Field not found');const prototype=element.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  }
  async function select(label, value) {
    await click(`button[role="combobox"][aria-label="${label}"]`);
    await clickText(value, '[role="option"]');
  }
  async function screenshot(name) {
    const result = await page.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await writeFile(join(directory, `${name}.png`), Buffer.from(result.data, 'base64'));
  }
  const session = () =>
    evaluate(
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
  async function login(email, password) {
    await goto('/account', 'Welcome Back');
    await input('#customer-login-email', email);
    await input('#customer-login-password', password);
    await clickText('Sign In');
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
  await select('Items per page', '16');
  await waitFor(
    () => evaluate('document.querySelectorAll("main article").length === 16'),
    'Sixteen menu items per page',
  );
  assert.equal(await evaluate('new URL(location.href).searchParams.get("size")'), '16');
  await click('button[role="combobox"][aria-label="Items per page"]');
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
  for (const [field, value] of Object.entries({
    name: 'Browser Customer',
    email,
    phone: '555-1234567',
    password: app.password,
    confirmPassword: app.password,
  }))
    await input(`#register-${field}`, value);
  await clickText('Create Account');
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
  await input('#checkout-address', '123 Browser Test Street');
  await page.send('Browser.grantPermissions', { permissions: ['geolocation'], origin: app.base });
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
  await clickText('Place Order');
  await waitText('Order Details');
  const customer = await session();
  const own = await api('/orders/my-orders?page=1&limit=100', { token: customer.token });
  assert.equal(own.status, 200);
  assert.equal(own.body.orders.length, 1);
  const order = own.body.orders[0];
  assert.equal(order.deliveryLocationProvided, true);
  assert.equal(await has(order.orderNumber), true);
  assert.equal(await has('Truffle Smoke Burger'), true);
  await goto('/orders', 'My Order History');
  await waitText(order.orderNumber);
  assert.equal(
    await evaluate(
      '(()=>{const main=document.querySelector("main");const content=main.querySelector(":scope > div");const css=getComputedStyle(main);return Math.abs(content.getBoundingClientRect().width-(main.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight)))<2})()',
    ),
    true,
  );
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
  const fullWidth = await evaluate('document.querySelector("main").getBoundingClientRect().width');
  await openNavigation();
  assert.equal(
    await evaluate(`Boolean(document.querySelector('#site-navigation a[href="/users"]'))`),
    false,
  );
  await waitFor(
    async () =>
      (await evaluate('document.querySelector("main").getBoundingClientRect().width')) <
      fullWidth - 250,
    'Desktop drawer reserves content width',
  );
  const narrowWidth = await evaluate(
    'document.querySelector("main").getBoundingClientRect().width',
  );
  await click('[aria-label="Close navigation drawer"]');
  await waitFor(
    async () =>
      (await evaluate('document.querySelector("main").getBoundingClientRect().width')) >
      narrowWidth + 200,
    'Desktop drawer restores content width',
  );
  pass(
    'Customer registration, red field errors, cart continuity, checkout, location pin and owned history',
  );

  await logout();
  await login('dispatcher@example.test', app.password);
  await waitText('Kitchen Dispatch Station');
  await openNavigation();
  await click('#site-navigation a[href="/users"]');
  await waitText('Manage customer accounts');
  await input('#users-search', email);
  await clickText('Search Users');
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
  await clickText('Save Changes');
  await waitFor(() => evaluate('!document.querySelector("dialog[open]")'), 'Saved role editor');
  assert.equal((await api('/auth/me', { token: customer.token })).status, 401);
  await input('#users-search', nextEmail);
  await clickText('Search Users');
  await waitText(nextEmail);
  await screenshot('users-desktop');
  pass('Admin Users search, profile editing and courier promotion revoke the previous session');

  await logout();
  await login(nextEmail, app.password);
  await waitText('Available Deliveries');
  await waitText(order.orderNumber);
  await openNavigation();
  const links = await evaluate(
    '[...document.querySelectorAll("#site-navigation a")].map(element=>element.getAttribute("href"))',
  );
  assert(
    links.includes('/courier') &&
      links.includes('/orders') &&
      !links.includes('/users') &&
      !links.includes('/dispatch'),
  );
  await click('[aria-label="Close navigation drawer"]');
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
  await clickText('Approve', 'button');
  await waitText('A courier is assigned');
  await logout();
  await login(nextEmail, app.password);
  await goto('/orders', 'My Deliveries');
  await waitText(order.orderNumber);
  await evaluate(
    `(()=>{const link=[...document.querySelectorAll('main a')].find(element=>element.textContent.includes('Manage Delivery'));link.click()})()`,
  );
  await waitText('Update Status');
  for (const status of ['CONFIRMED', 'PREPARING', 'READY FOR PICKUP', 'OUT FOR DELIVERY']) {
    await select('Order status', status);
    await clickText('Update Status');
    await waitFor(
      () =>
        evaluate(
          `document.querySelector('button[aria-label="Order status"]')?.textContent.includes(${JSON.stringify(status)}) && [...document.querySelectorAll('button')].some(element=>element.textContent.trim()==='Update Status'&&element.disabled)`,
        ),
      'Updated delivery stage',
    );
  }
  await waitText('Share Your Location');
  await clickText('Start Sharing');
  await waitText('Sharing is on.');
  const courier = await session();
  const located = await api(`/orders/${order.id}`, { token: courier.token });
  assert.equal(located.body.order.courierCoordinates.lat, 40.713);
  await clickText('Stop Sharing');
  await waitText('Location sharing is off.');
  await select('Order status', 'CANCELLED');
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
    await click('button[aria-label="Switch to dark mode"]');
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
  assert.match(documentResponse.headers.get('content-security-policy'), /script-src 'self'/);
  assert(!documentResponse.headers.get('content-security-policy').includes('unsafe-eval'));
  assert.equal(
    (await fetch(app.base + '/api/unknown', { headers: { Accept: 'text/html' } })).status,
    404,
  );
  assert.equal((await fetch(app.base + '/missing.js')).status, 404);
  const html = await (await fetch(app.base)).text();
  const asset = html
    .match(/src="([^"]+\.js)"/g)
    .map((value) => value.slice(5, -1))
    .find((value) => value.startsWith('/assets/'));
  const compressed = await fetch(app.base + asset, { headers: { 'Accept-Encoding': 'br' } });
  assert.equal(compressed.headers.get('content-encoding'), 'br');
  assert.match(compressed.headers.get('cache-control'), /immutable/);
  pass('Production direct URLs, API/asset 404s, strict CSP and compressed immutable assets');

  let viteLog = '';
  const viteCli = join(dirname(frontendRequire.resolve('vite/package.json')), 'bin/vite.js');
  vite = spawn(
    process.execPath,
    [viteCli, '--host', '127.0.0.1', '--port', String(proxyPort), '--strictPort'],
    {
      cwd: resolve('frontend'),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, API_PROXY_TARGET: app.base },
    },
  );
  vite.stdout.on('data', (data) => {
    viteLog = (viteLog + data).slice(-10_000);
  });
  vite.stderr.on('data', (data) => {
    viteLog = (viteLog + data).slice(-10_000);
  });
  await waitFor(async () => {
    try {
      return (await fetch(proxyOrigin + '/api/config')).ok;
    } catch {
      return false;
    }
  }, 'Private Vite proxy');
  const proxyLogin = await api('/auth/login', {
    method: 'POST',
    body: { email: 'dispatcher@example.test', password: app.password },
  });
  const proxyToken = proxyLogin.body.accessToken;
  async function connect(expectFailure = false) {
    const socket = io(proxyOrigin, {
      transports: ['websocket'],
      reconnection: false,
      auth: { token: proxyToken },
      extraHeaders: { Origin: proxyOrigin },
    });
    sockets.push(socket);
    await new Promise((resolveReady, reject) => {
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
  const output = resolve(`documentation/quality/browser-${measuredAt.slice(0, 10)}.json`);
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
  if (page) {
    const capture = await page
      .send('Page.captureScreenshot', { format: 'png' })
      .catch(() => undefined);
    if (capture)
      await writeFile(join(directory, 'failure.png'), Buffer.from(capture.data, 'base64'));
    console.log(`Browser failure screenshot: ${join(directory, 'failure.png')}`);
  }
  throw error;
} finally {
  for (const socket of sockets) socket.disconnect();
  if (vite && vite.exitCode === null) {
    const exited = once(vite, 'exit');
    vite.kill();
    await exited;
  }
  await page?.dispose().catch(() => undefined);
  await browser?.close();
  await runtime.close();
}
