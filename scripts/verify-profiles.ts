import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createIsolatedRuntime } from '../backend/scripts/isolated-runtime.ts';
import { launchBrowser, waitFor, type Browser, type BrowserPage } from './lib/browser.ts';
import type {
  AuthResponse,
  AuthChallengeResponse,
  OrderDetails,
  NotificationPage,
  ProfileChange,
  ProfileResponse,
} from '../shared/src/index.ts';
import { MENU_ITEMS } from '../shared/src/catalog.ts';
import { parseJson, responseJson } from './lib/json.ts';
import { checkPasswordVisibility } from './lib/password-controls.ts';

const runtime = await createIsolatedRuntime({ count: 2, serveFrontend: true });
const directory = await mkdtemp(join(tmpdir(), 'ktd-profile-browser-'));
let customerBrowser: Browser | undefined;
let adminBrowser: Browser | undefined;
const pages: BrowserPage[] = [];
const errors: string[] = [];
const checks: string[] = [];
const pass = (message: string) => {
  checks.push(message);
  console.log(`PASS ${message}`);
};

function controls(page: BrowserPage) {
  const evaluate = <T = unknown>(expression: string) => page.evaluate<T>(expression);
  const visibleText = (value: string) =>
    evaluate<boolean>(`document.body?.textContent?.includes(${JSON.stringify(value)})??false`);
  async function text(label: string) {
    await waitFor(() => visibleText(label), label);
  }
  async function click(selector: string) {
    await waitFor(
      () =>
        evaluate(
          `(()=>{const el=document.querySelector(${JSON.stringify(selector)});return !!el&&!el.disabled})()`,
        ),
      selector,
    );
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  }
  async function button(label: string) {
    const target = `(()=>{const scope=[...document.querySelectorAll('dialog[open]')].at(-1)||document;return [...scope.querySelectorAll('button')].find(el=>el.textContent.trim()===${JSON.stringify(label)}&&!el.disabled)})()`;
    await waitFor(() => evaluate(`Boolean(${target})`), label);
    await evaluate(`${target}.click()`);
  }
  async function fill(selector: string, value: string) {
    await waitFor(
      () => evaluate(`Boolean(document.querySelector(${JSON.stringify(selector)}))`),
      selector,
    );
    await evaluate(
      `(()=>{const el=document.querySelector(${JSON.stringify(selector)});const prototype=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
  }
  async function goto(path: string, label: string) {
    await page.send('Page.navigate', { url: path });
    await text(label);
  }
  async function completeOtp(email: string) {
    await waitFor(
      () =>
        evaluate(
          'Boolean(document.querySelector("#email-otp-code") || localStorage.getItem("ktd_token"))',
        ),
      'Sign-in challenge or authenticated session',
    );
    if (await evaluate('Boolean(document.querySelector("#email-otp-code"))')) {
      const code = await runtime.takeOtp(email);
      await fill('#email-otp-code', code);
      await button('Verify and Sign In');
    }
  }
  return { evaluate, text, click, button, fill, goto, completeOtp };
}

async function settleVisuals(page: BrowserPage) {
  await waitFor(
    () =>
      page.evaluate<boolean>(
        "!document.documentElement.matches(':active-view-transition')&&document.getAnimations().every(animation=>animation.playState!=='running'||animation.effect?.getTiming().iterations===Infinity)",
      ),
    'Settled visual transitions',
  );
}

try {
  const app = await runtime.start();
  async function api<T>(path: string, token: string, method = 'GET', body?: unknown): Promise<T> {
    const response = await fetch(app.base + '/api' + path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    assert(response.ok, `${path}: ${response.status} ${await response.clone().text()}`);
    return responseJson<T>(response);
  }
  async function registerFixture(email: string, name: string): Promise<AuthResponse> {
    const challenge = await api<AuthChallengeResponse>('/auth/register', '', 'POST', {
      name,
      email,
      phone: '555-1234',
      password: app.password,
    });
    const code = await runtime.takeOtp(email);
    return api<AuthResponse>('/auth/email/verify', '', 'POST', {
      challengeId: challenge.challengeId,
      code,
      deviceId: randomUUID(),
    });
  }
  customerBrowser = await launchBrowser();
  const customerPage = await customerBrowser.page(app.base + '/account');
  pages.push(customerPage);
  const customer = controls(customerPage);
  let capturedAccountMenu = false;
  async function openProfile() {
    await customer.click('button[aria-label="Open Account Menu"]');
    await customer.text('Test Customer');
    await customer.text('customer@example.test');
    await customer.text('Customer');
    if (!capturedAccountMenu) {
      await settleVisuals(customerPage);
      await writeFile(
        join(directory, 'account-dropdown-light.png'),
        Buffer.from(
          (await customerPage.send('Page.captureScreenshot', { format: 'png' })).data,
          'base64',
        ),
      );
      capturedAccountMenu = true;
    }
    await customer.click('#account-menu button:first-of-type');
    await customer.text('Manage your personal details, delivery address and profile photo.');
  }
  async function openAccountMenu() {
    await customer.click('button[aria-label="Open Account Menu"]');
  }
  customerPage.on('Runtime.exceptionThrown', (event) =>
    errors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text),
  );
  await customerPage.send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await customer.text('Welcome Back');
  await customer.fill('#customer-login-email', 'customer@example.test');
  await customer.fill('#customer-login-password', app.password);
  let pausedLogin: string | undefined;
  let pausedLogout: string | undefined;
  customerPage.on('Fetch.requestPaused', (event) => {
    if (event.request.url.endsWith('/auth/login')) pausedLogin = event.requestId;
    else if (event.request.url.endsWith('/auth/logout')) pausedLogout = event.requestId;
    else void customerPage.send('Fetch.continueRequest', { requestId: event.requestId });
  });
  await customerPage.send('Fetch.enable', {
    patterns: [{ urlPattern: app.base + '/api/auth/login', requestStage: 'Request' }],
  });
  await customer.button('Sign In');
  await waitFor(() => pausedLogin, 'Paused login');
  assert(
    await customer.evaluate(
      `(()=>{const el=document.querySelector('dialog[aria-labelledby="auth-progress-title"]');return !!el?.open&&el.getBoundingClientRect().width>=innerWidth-1&&el.textContent.includes('Signing In')})()`,
    ),
  );
  await customerPage.send('Fetch.continueRequest', { requestId: pausedLogin! });
  await customerPage.send('Fetch.disable');
  await customer.completeOtp('customer@example.test');
  await customer.text('My Order History');
  const customerToken = await customer.evaluate<string>("localStorage.getItem('ktd_token')");
  pass('Signing in displays a branded full-page glass loading dialog');

  await waitFor(
    () =>
      customer.evaluate(
        '!!document.querySelector(\'main button[aria-label^="View Receipt PDF"]\')',
      ),
    'Receipt action',
  );
  assert(
    await customer.evaluate(
      "[...document.querySelectorAll('main span')].some(el=>el.textContent.trim()==='READY FOR PICKUP'&&el.className.includes('text-indigo'))",
    ),
  );
  assert(
    await customer.evaluate(
      "document.querySelector('main button[aria-label^=\"View Receipt PDF\"] svg').classList.contains('lucide-file-text')",
    ),
  );
  assert(
    await customer.evaluate(
      "document.querySelector('main a[aria-label=\"Live Tracking\"] svg').classList.contains('lucide-navigation')",
    ),
  );
  await customer.click('main button[aria-label^="View Receipt PDF"]');
  await waitFor(
    () =>
      customer.evaluate(
        `(()=>{const canvas=document.querySelector('dialog canvas');return !!canvas&&canvas.width>100&&!canvas.parentElement.querySelector('[role="status"]')})()`,
      ),
    'Rendered PDF canvas',
    30_000,
  );
  await waitFor(
    () =>
      customer.evaluate(
        `(()=>{const pages=[...document.querySelectorAll('dialog canvas')].map(canvas=>canvas.parentElement.querySelector('.sr-only')?.textContent||'');return pages.length===2&&pages[0].includes('Order Number')&&pages[0].includes('Quantity')&&pages[0].includes('Unit Price')&&pages[0].includes('Current Status')&&pages[0].indexOf('Current Status')<pages[0].indexOf('Items')&&!pages[0].includes('Order History')&&pages[1].includes('Order History')&&pages.every(text=>text.includes('Page')&&!text.includes('Order summary only.')&&!text.includes('This app does not collect payment.'))})()`,
      ),
    'Receipt labels and a separate Order History page',
    30_000,
  );
  await Promise.all(
    [0, 1].map(async (index) => {
      const source = await customer.evaluate<string>(
        `document.querySelectorAll('dialog canvas')[${index}].toDataURL('image/png')`,
      );
      await writeFile(
        join(directory, `receipt-page-${index + 1}.png`),
        Buffer.from(source.split(',')[1]!, 'base64'),
      );
    }),
  );
  assert(
    await customer.evaluate(
      "!document.querySelector('dialog iframe')&&!document.querySelector('dialog input')&&document.querySelectorAll('main:not([hidden])').length===1&&!!document.querySelector('dialog [role=region][aria-label=\"Receipt Preview\"]')",
    ),
  );
  assert(
    await customer.evaluate(
      `(()=>{const canvas=document.querySelector('dialog canvas');const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let colored=0;for(let i=0;i<pixels.length;i+=400)if(pixels[i]<225)colored++;return colored>50})()`,
    ),
  );
  await customerPage.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: directory,
  });
  await customer.button('Download Receipt');
  let download: string | undefined;
  await waitFor(async () => {
    download = (await readdir(directory)).find((name) => name.endsWith('.pdf'));
    return !!download;
  }, 'Downloaded receipt');
  assert((await readFile(join(directory, download!))).subarray(0, 5).toString() === '%PDF-');
  await writeFile(
    join(directory, 'receipt-preview.png'),
    Buffer.from(
      (await customerPage.send('Page.captureScreenshot', { format: 'png' })).data,
      'base64',
    ),
  );
  await customerPage.send('Emulation.setDeviceMetricsOverride', {
    width: 360,
    height: 800,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await waitFor(
    () =>
      customer.evaluate(
        `(()=>{const modal=document.querySelector('dialog[open]');return [...modal.querySelectorAll('footer button')].every(button=>{const bounds=button.getBoundingClientRect();return bounds.left>=modal.getBoundingClientRect().left&&bounds.right<=modal.getBoundingClientRect().right&&bounds.bottom<=innerHeight})})()`,
      ),
    'Receipt footer controls fit a narrow mobile screen',
  );
  await customerPage.send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await customer.button('Cancel');
  pass(
    'Customer status colors, distinct tracking/receipt icons, rendered PDF pages and footer download',
  );

  const largeOrder = await api<{ order: OrderDetails }>('/orders', customerToken, 'POST', {
    customer: { name: 'Receipt Browser Customer', phone: '555-1234', address: '123 Test Street' },
    deliveryAddress: '123 Test Street',
    items: MENU_ITEMS.map((item) => ({
      itemId: item.id,
      name: item.name,
      price: item.price,
      quantity: 1,
    })),
  });
  const japaneseCopy = parseJson<{ food: Record<string, string>; receipt: Record<string, string> }>(
    await readFile(new URL('../frontend/src/locales/ja.json', import.meta.url), 'utf8'),
  );
  async function checkLargeReceipt(language: 'en' | 'ja') {
    await customer.goto(app.base + '/orders', language === 'ja' ? '注文履歴' : 'My Order History');
    await customer.click('main button:has(svg.lucide-file-text)');
    const names = MENU_ITEMS.map((item) =>
      (language === 'ja' ? japaneseCopy.food[item.name] || item.name : item.name)
        .normalize('NFKC')
        .replaceAll(' ', ''),
    );
    const labels = {
      quantity: language === 'ja' ? japaneseCopy.receipt.quantity : 'Quantity',
      unitPrice: language === 'ja' ? japaneseCopy.receipt.unitPrice : 'Unit Price',
      history: language === 'ja' ? japaneseCopy.receipt.statusHistory : 'Order History',
      subtotal: language === 'ja' ? japaneseCopy.receipt.subtotal : 'Subtotal',
      footer: language === 'ja' ? japaneseCopy.receipt.page : 'Page',
    };
    await waitFor(
      () =>
        customer.evaluate(
          `(()=>{const names=${JSON.stringify(names)};const labels=${JSON.stringify(labels)};const pages=[...document.querySelectorAll('dialog canvas')].map(canvas=>canvas.parentElement.querySelector('.sr-only')?.textContent||'');const normalized=pages.map(text=>text.normalize('NFKC').replaceAll(' ',''));const all=normalized.join('');const history=pages.findIndex(text=>text.includes(labels.history));return pages.length>=3&&all.includes(${JSON.stringify(largeOrder.order.orderNumber)})&&names.every(name=>all.includes(name))&&history>0&&pages.slice(0,history).some(text=>text.includes(labels.subtotal))&&pages.every(text=>text.includes(labels.footer)&&!text.includes('Order summary only.')&&!text.includes('This app does not collect payment.')&&!text.includes('このアプリで決済は行われません。'))&&normalized.every((text,index)=>!names.some(name=>text.includes(name))||(index<history&&pages[index].includes(labels.quantity)&&pages[index].includes(labels.unitPrice)))})()`,
        ),
      `Complete ${language} receipt, repeated headers and a separate history page`,
      45_000,
    );
    await Promise.all(
      (
        [
          ['page-1', 0],
          ['history', -1],
        ] as const
      ).map(async ([name, index]) => {
        const source = await customer.evaluate<string>(
          `[...document.querySelectorAll('dialog canvas')].at(${index}).toDataURL('image/png')`,
        );
        await writeFile(
          join(directory, `receipt-large-${language}-${name}.png`),
          Buffer.from(source.split(',')[1]!, 'base64'),
        );
      }),
    );
    await customer.click(
      'dialog[aria-labelledby="receipt-preview-title"] footer button:first-of-type',
    );
  }
  await checkLargeReceipt('en');
  await customer.click('header button[role="combobox"]');
  await customer.click('[role="option"]:nth-of-type(2)');
  await waitFor(
    () => customer.evaluate("document.documentElement.lang==='ja'"),
    'Japanese receipts',
  );
  await checkLargeReceipt('ja');
  await customer.click('header button[role="combobox"]');
  await customer.click('[role="option"]:first-of-type');
  await waitFor(
    () => customer.evaluate("document.documentElement.lang==='en'"),
    'Return to English',
  );
  pass(
    'Long EN/JA receipts retain all 27 dishes, repeated table headers, totals, footers and separate history pages',
  );

  await openProfile();
  await waitFor(
    () => customer.evaluate("Boolean(document.querySelector('#profile-email'))"),
    'Loaded profile form',
  );
  assert(await customer.evaluate("document.querySelector('#profile-email').readOnly"));
  assert(
    await customer.evaluate(
      `(()=>{const fields=['name','phone','email'].map(key=>document.querySelector('#profile-'+key).getBoundingClientRect());const password=document.querySelector('fieldset');return Math.max(...fields.map(r=>r.top))-Math.min(...fields.map(r=>r.top))<2&&parseFloat(getComputedStyle(password).borderRadius)>0&&parseFloat(getComputedStyle(password).borderBottomWidth)>0})()`,
    ),
  );
  pass('Profile contact fields share one desktop row and password fields use a rounded fieldset');
  for (const width of [720, 960]) {
    await customerPage.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    if (await customer.evaluate("!!document.querySelector('dialog.navigation-dialog[open]')"))
      await customer.click('dialog.navigation-dialog button[aria-label="Close navigation drawer"]');
    await waitFor(
      () =>
        customer.evaluate(
          `(()=>{const rect=id=>document.querySelector('#profile-'+id).getBoundingClientRect();const contact=['name','email','phone'].map(rect);const password=['currentPassword','password','confirmPassword'].map(rect);const address=document.querySelector('#profile-address').getBoundingClientRect();const grid=document.querySelector('#profile-address').parentElement.parentElement.getBoundingClientRect();return contact[0].left<contact[1].left&&Math.abs(contact[0].top-contact[1].top)<2&&contact[2].top>contact[0].top&&Math.abs(password[0].top-password[1].top)<2&&password[2].top>password[0].top&&Math.abs(address.width-grid.width)<2&&document.documentElement.scrollWidth<=innerWidth+1})()`,
        ),
      `Two-column profile and password layout with full-width address at ${width}px`,
    );
  }
  await settleVisuals(customerPage);
  await writeFile(
    join(directory, 'profile-tablet.png'),
    Buffer.from(
      (await customerPage.send('Page.captureScreenshot', { format: 'png' })).data,
      'base64',
    ),
  );
  await customerPage.send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const originalName = await customer.evaluate<string>(
    "document.querySelector('#profile-name').value",
  );
  await customer.fill('#profile-name', 'Unsaved Browser Draft');
  await customer.fill('#profile-password', 'Draft-only#Password2026!');
  await checkPasswordVisibility(customerPage, 'profile-currentPassword');
  await checkPasswordVisibility(customerPage, 'profile-password');
  await checkPasswordVisibility(customerPage, 'profile-confirmPassword');
  await customer.text('Unsaved Changes');
  await waitFor(
    () =>
      customer.evaluate(
        "(()=>{const event=new Event('beforeunload',{cancelable:true});dispatchEvent(event);return event.defaultPrevented})()",
      ),
    'Reload warning enabled for unsaved draft',
  );
  assert(
    !(await customer.evaluate(
      "Object.values(localStorage).some(value=>value.includes('Draft-only#Password2026!'))",
    )),
  );
  const editedProfile = await api<ProfileResponse>('/profile', customerToken);
  await api(`/users/${editedProfile.user.id}`, app.token, 'PATCH', {
    name: editedProfile.user.name,
    email: editedProfile.user.email,
    phone: editedProfile.user.phone || '',
    address: editedProfile.user.address || '',
    role: editedProfile.user.role,
    disabled: false,
    expectedUpdatedAt: editedProfile.user.updatedAt,
  });
  await customer.evaluate(
    "window.dispatchEvent(new Event('visibilitychange'));window.dispatchEvent(new Event('focus'))",
  );
  await new Promise((resolve) => setTimeout(resolve, 750));
  assert.equal(
    await customer.evaluate("document.querySelector('#profile-name').value"),
    'Unsaved Browser Draft',
    'A shared account query must not replace the draft on window focus',
  );
  await customer.click('dialog[open] header button[aria-label="Close"]');
  await customer.text('Discard Unsaved Changes?');
  await customer.button('Keep Editing');
  await waitFor(
    () => customer.evaluate("!!document.querySelector('#profile-name')"),
    'Profile modal remains open after keeping the draft',
  );
  assert.equal(
    await customer.evaluate("document.querySelector('#profile-name').value"),
    'Unsaved Browser Draft',
  );
  await customer.button('Cancel');
  await customer.text('Discard Unsaved Changes?');
  await writeFile(
    join(directory, 'profile-unsaved-confirmation.png'),
    Buffer.from(
      (await customerPage.send('Page.captureScreenshot', { format: 'png' })).data,
      'base64',
    ),
  );
  await customer.button('Keep Editing');
  assert.equal(
    await customer.evaluate("document.querySelector('#profile-password').value"),
    'Draft-only#Password2026!',
  );
  await customer.button('Cancel');
  await customer.button('Discard Changes');
  await waitFor(
    () => customer.evaluate("!document.querySelector('dialog[open]')"),
    'Cancel closes the profile modal after discarding',
  );
  await openProfile();
  await waitFor(
    () =>
      customer.evaluate(
        `document.querySelector('#profile-name').value===${JSON.stringify(originalName)}&&document.querySelector('#profile-password').value===''&&!document.body.textContent.includes('Unsaved Changes')`,
      ),
    'Discard resets the draft and passwords',
  );
  await waitFor(
    () =>
      customer.evaluate(
        "(()=>{const event=new Event('beforeunload',{cancelable:true});dispatchEvent(event);return !event.defaultPrevented})()",
      ),
    'Reload warning removed for clean profile',
  );
  await customer.click('dialog[open] header button[aria-label="Close"]');
  await waitFor(
    () => customer.evaluate("!document.querySelector('dialog[open]')"),
    'Closed profile',
  );
  if (
    await customer.evaluate(
      "document.querySelector('header button[aria-controls=\"site-navigation\"]').getAttribute('aria-expanded')==='false'",
    )
  )
    await customer.click('header button[aria-controls="site-navigation"]');
  await customer.click('a[href="/notifications"]');
  await customer.text('Profile requests, review decisions and your notification history.');
  await openProfile();
  await customer.fill('#profile-name', 'Navigation Draft');
  await customer.evaluate('history.back()');
  await customer.text('Discard Unsaved Changes?');
  await customer.button('Keep Editing');
  assert.equal(await customer.evaluate('location.pathname'), '/notifications');
  assert.equal(
    await customer.evaluate("document.querySelector('#profile-name').value"),
    'Navigation Draft',
  );
  await customer.evaluate('history.back()');
  await customer.text('Discard Unsaved Changes?');
  await customer.button('Discard Changes');
  await waitFor(
    () =>
      customer.evaluate("location.pathname==='/orders'&&!document.querySelector('dialog[open]')"),
    'Back navigation closes the profile modal after discarding',
  );
  await openProfile();
  await waitFor(
    () =>
      customer.evaluate(
        `document.querySelector('#profile-name')?.value===${JSON.stringify(originalName)}`,
      ),
    'Discarded draft was not submitted',
  );
  assert.equal((await api<ProfileResponse>('/profile', customerToken)).pending, null);
  pass(
    'Profile drafts survive focus updates, warn on Back/reload and close only after confirmed navigation',
  );
  const photoSource = await customer.evaluate<string>(
    "(()=>{const canvas=document.createElement('canvas');canvas.width=40;canvas.height=40;const ctx=canvas.getContext('2d');ctx.fillStyle='#0d9488';ctx.fillRect(0,0,40,40);return canvas.toDataURL('image/png')})()",
  );
  const photoPath = join(directory, 'profile-photo.png');
  await writeFile(photoPath, Buffer.from(photoSource.split(',')[1]!, 'base64'));
  const badPhotoPath = join(directory, 'invalid-photo.png');
  await writeFile(badPhotoPath, 'This is not an image.');
  let checkedInvalidPhoto = false;
  async function choosePhoto() {
    await customer.button('Choose Photo');
    await customer.text('Select a Photo to Upload');
    const document = await customerPage.send('DOM.getDocument');
    const input = await customerPage.send('DOM.querySelector', {
      nodeId: document.root.nodeId,
      selector: 'dialog[open] input[type="file"]',
    });
    if (!checkedInvalidPhoto) {
      await customerPage.send('DOM.setFileInputFiles', {
        nodeId: input.nodeId,
        files: [badPhotoPath],
      });
      await customer.text('The photo could not be loaded.');
      assert(
        await customer.evaluate('!!document.querySelector(\'dialog button[aria-invalid="true"]\')'),
      );
      checkedInvalidPhoto = true;
    }
    await customerPage.send('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [photoPath] });
    await customer.text('profile-photo.png');
    await customer.button('Use Photo');
  }
  await choosePhoto();
  await customer.fill('#profile-name', 'Browser Updated Customer');
  await customer.fill('#profile-phone', '555-9876543');
  await customer.fill('#profile-address', '456 Browser Avenue');
  await customer.button('Submit for Approval');
  await customer.text('Your profile changes are awaiting administrator approval.');
  let requested = await api<ProfileResponse>('/profile', customerToken);
  assert.equal(requested.user.name, 'Test Customer');
  assert.equal(requested.user.photoId, null);
  const rejectedId = requested.pending!.id;
  pass('Profile email is read-only; photo uploader and requested contact changes remain pending');

  adminBrowser = await launchBrowser();
  const adminPage = await adminBrowser.page(app.base + '/users');
  pages.push(adminPage);
  const admin = controls(adminPage);
  adminPage.on('Runtime.exceptionThrown', (event) =>
    errors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text),
  );
  await adminPage.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await admin.text('Sign In to Continue');
  await admin.evaluate(
    `localStorage.setItem('ktd_token',${JSON.stringify(app.token)});localStorage.setItem('ktd_user',${JSON.stringify(JSON.stringify(app.user))})`,
  );
  await admin.goto(
    app.base + '/users',
    'Manage customer accounts, courier access, and administrators.',
  );
  async function openAdminNotification(id: string) {
    await admin.click('button[aria-label^="Notifications,"]');
    await waitFor(
      () => admin.evaluate(`!!document.querySelector('[data-notification-id="${id}"]')`),
      'Requested notification',
    );
    await admin.click(`[data-notification-id="${id}"] > button`);
    await admin.text('Previous and Requested Profile Information');
    await waitFor(
      async () =>
        !(await api<{ notification: ProfileChange }>(`/notifications/${id}`, app.token))
          .notification.unread,
      'Admin notification marked read',
    );
    assert(
      await admin.evaluate(
        `(()=>{const table=document.querySelector('dialog[open] table');const changed=[...table.querySelectorAll('tbody tr')].map(row=>[...row.querySelectorAll('td')]).filter(cells=>cells.length===2&&cells[0].textContent!==cells[1].textContent);return [...table.querySelectorAll('thead th')].every(el=>getComputedStyle(el).textAlign==='center')&&changed.some(cells=>getComputedStyle(cells[0]).color!==getComputedStyle(cells[1]).color)&&!!document.querySelector('dialog[open] time[datetime]')})()`,
      ),
    );
  }
  await openAdminNotification(rejectedId);
  await admin.button('Reject');
  await admin.text('Reason for Rejection');
  await admin.fill('#profile-rejection-feedback', 'Please include the apartment number.');
  await admin.button('Confirm Rejection');
  await admin.text('Please include the apartment number.');
  await admin.text(app.user.email);
  await admin.button('Cancel');
  await customer.goto(
    app.base + '/notifications',
    'Profile requests, review decisions and your notification history.',
  );
  await customer.click(`[data-notification-id="${rejectedId}"] > button`);
  await customer.text('Please include the apartment number.');
  assert(
    !(await customer.evaluate(
      "[...document.querySelectorAll('dialog[open] button')].some(button=>button.textContent.trim()==='Approve')",
    )),
  );
  await customer.button('Cancel');
  pass(
    'Admin notification opens previous/requested values; rejection requires feedback and notifies the owner',
  );

  await openProfile();
  await customer.text('Manage your personal details, delivery address and profile photo.');
  await choosePhoto();
  await customer.fill('#profile-name', 'Approved Browser Customer');
  await customer.fill('#profile-address', '456 Browser Avenue, Apartment 10');
  await customer.button('Submit for Approval');
  await customer.text('Your profile changes are awaiting administrator approval.');
  requested = await api<ProfileResponse>('/profile', customerToken);
  const approvedId = requested.pending!.id;
  await openAdminNotification(approvedId);
  await admin.button('Approve');
  await admin.text('Approved');
  await admin.text(app.user.email);
  await admin.button('Cancel');
  await customer.goto(
    app.base + '/notifications',
    'Profile requests, review decisions and your notification history.',
  );
  await customer.click(`[data-notification-id="${approvedId}"] > button`);
  await customer.text('Profile Change Request');
  await customer.button('Cancel');
  await openAccountMenu();
  await waitFor(
    () =>
      customer.evaluate(
        "(()=>{const image=document.querySelector('#account-menu img');return !!image?.complete&&image.naturalWidth>0})()",
      ),
    'Approved profile photo in account menu',
  );
  await customer.click('#account-menu button:first-of-type');
  await customer.text('Manage your personal details, delivery address and profile photo.');
  await waitFor(
    () =>
      customer.evaluate(
        "(()=>{const image=document.querySelector('dialog img');return document.querySelector('#profile-name')?.value==='Approved Browser Customer'&&!!image?.complete&&image.naturalWidth>0})()",
      ),
    'Approved profile photo in profile dialog',
  );
  assert.equal(
    (await api<ProfileResponse>('/profile', customerToken)).user.address,
    '456 Browser Avenue, Apartment 10',
  );
  await waitFor(async () => {
    const ownerNotifications = await api<NotificationPage>('/notifications', customerToken);
    return (
      ownerNotifications.notifications.find((item) => item.id === approvedId)?.unread === false
    );
  }, 'Opening and quickly closing the preview still marks the notification read');
  pass(
    'Approval applies the photo/address/name, updates the profile screen and persists read status',
  );

  await admin.click('button[aria-labelledby="users-role-label"]');
  await admin.click('[role="option"]:nth-of-type(3)');
  assert(!(await admin.evaluate("location.search.includes('COURIER')")));
  await admin.button('Filter');
  await waitFor(
    () =>
      admin.evaluate(
        "location.search.includes('COURIER')&&document.querySelectorAll('main tbody tr').length===1",
      ),
    'Applied courier role filter',
  );
  const widths = await admin.evaluate<{ search: number; filter: number; settings: number }>(
    "(()=>{const buttons=[...document.querySelectorAll('main button')];return {search:document.querySelector('#users-search').getBoundingClientRect().width,filter:buttons.find(el=>el.textContent.trim()==='Filter').getBoundingClientRect().width,settings:buttons.find(el=>el.textContent.trim()==='Settings').getBoundingClientRect().width}})()",
  );
  assert(Math.abs(widths.search - 360) < 2, JSON.stringify(widths));
  assert(widths.filter < 110 && widths.settings < 120);
  await admin.button('Settings');
  await admin.evaluate(
    "[...document.querySelectorAll('dialog label')].find(label=>label.textContent.trim()==='Delivery Address').querySelector('input').click()",
  );
  await admin.button('Save Settings');
  assert(
    !(await admin.evaluate(
      "[...document.querySelectorAll('main th')].some(el=>el.textContent.trim()==='Delivery Address')",
    )),
  );
  await admin.goto(
    app.base + '/users?role=COURIER',
    'Manage customer accounts, courier access, and administrators.',
  );
  assert(
    !(await admin.evaluate(
      "[...document.querySelectorAll('main th')].some(el=>el.textContent.trim()==='Delivery Address')",
    )),
  );
  await admin.button('Settings');
  await admin.button('Restore Defaults');
  await admin.button('Save Settings');
  await admin.click('button[aria-label^="Edit "]');
  await admin.text('Edit User');
  await admin.fill('#edit-user-phone', '555-0001234');
  await admin.button('Save Changes');
  await admin.click('button[aria-label^="View History for"]');
  await admin.text('Account Administration History');
  await admin.text('Phone');
  await admin.button('Cancel');
  pass(
    'Users role filtering, compact controls, 360px search, saved columns and administrator edit history',
  );

  for (const width of [1024, 1280, 1600]) {
    await adminPage.send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    });
    for (const [path, heading] of [
      ['/dispatch', 'Kitchen Dispatch Station'],
      ['/users', 'Manage customer accounts, courier access, and administrators.'],
      ['/notifications', 'Profile requests, review decisions and your notification history.'],
    ] as const) {
      await admin.goto(app.base + path, heading);
      await waitFor(
        () =>
          admin.evaluate(
            `(()=>{const drawer=document.querySelector('.navigation-sidebar.is-open');const content=document.querySelector('.app-content');return !!drawer&&Math.abs(parseFloat(getComputedStyle(content).marginLeft)-drawer.getBoundingClientRect().width)<1})()`,
          ),
        `Settled ${path} drawer layout at ${width}px`,
      );
      const layout = await admin.evaluate<{ overflow: boolean; clipped: string[] }>(
        `(()=>{const clipped=[...document.querySelectorAll('main form button,main input[role="searchbox"]')].filter(element=>element.getClientRects().length).filter(element=>{const panel=element.closest('.glass-panel');if(!panel)return false;const r=element.getBoundingClientRect();const p=panel.getBoundingClientRect();return r.left<p.left-1||r.right>p.right+1}).map(element=>element.id||element.getAttribute('aria-label')||element.textContent.trim());return {overflow:document.documentElement.scrollWidth>innerWidth+1,clipped}})()`,
      );
      assert(
        !layout.overflow && layout.clipped.length === 0,
        `Responsive ${path} filters at ${width}px: ${JSON.stringify(layout)}`,
      );
    }
  }
  await adminPage.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  pass('Dispatch, Users and Notification filters fit desktop widths with the drawer open');

  await customerPage.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await customer.goto(
    app.base + '/profile',
    'Manage your personal details, delivery address and profile photo.',
  );
  await customer.click('button[aria-label="Close navigation drawer"]');
  await waitFor(
    () => customer.evaluate("!document.querySelector('dialog.navigation-dialog')?.open"),
    'Closed mobile navigation',
  );
  assert(await customer.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));
  await waitFor(
    () => customer.evaluate("!!document.querySelector('#profile-email')"),
    'Mobile profile form',
  );
  assert(
    await customer.evaluate(
      "(()=>{const fields=['name','email','phone'].map(key=>document.querySelector('#profile-'+key).getBoundingClientRect());return fields[0].top<fields[1].top&&fields[1].top<fields[2].top})()",
    ),
  );
  await customer.button('Choose Photo');
  await customer.text('Select a Photo to Upload');
  assert(
    await customer.evaluate(
      "(()=>{const rect=document.querySelector('dialog[open]').getBoundingClientRect();return rect.left>=0&&rect.right<=innerWidth&&rect.top>=0&&rect.bottom<=innerHeight})()",
    ),
  );
  await writeFile(
    join(directory, 'mobile-photo-uploader.png'),
    Buffer.from(
      (await customerPage.send('Page.captureScreenshot', { format: 'png' })).data,
      'base64',
    ),
  );
  await customer.button('Cancel');
  pass('Profile form and photo uploader fit mobile screens');

  await customerPage.send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await customerPage.send('Fetch.enable', {
    patterns: [{ urlPattern: app.base + '/api/auth/logout', requestStage: 'Request' }],
  });
  await customer.fill('#profile-name', 'Unsaved Sign-Out Draft');
  await openAccountMenu();
  await customer.button('Sign Out');
  await customer.text('Discard Unsaved Changes?');
  assert.equal(pausedLogout, undefined);
  await customer.button('Keep Editing');
  assert.equal(
    await customer.evaluate("document.querySelector('#profile-name').value"),
    'Unsaved Sign-Out Draft',
  );
  await openAccountMenu();
  await customer.button('Sign Out');
  await customer.button('Discard Changes');
  await waitFor(() => pausedLogout, 'Paused logout');
  assert(
    await customer.evaluate(
      "document.querySelector('dialog[aria-labelledby=\"auth-progress-title\"]')?.textContent.includes('Signing Out')",
    ),
  );
  await customerPage.send('Fetch.continueRequest', { requestId: pausedLogout! });
  await customerPage.send('Fetch.disable');
  await waitFor(
    () =>
      customer.evaluate(
        "!document.querySelector('dialog[aria-labelledby=\"auth-progress-title\"]')&&!localStorage.getItem('ktd_token')",
      ),
    'Completed logout',
  );
  pass('Signing out displays the glass loading dialog and clears the session');

  async function checkNotificationInteractions(id: string, token: string, message: string) {
    await api(`/notifications/${id}/read`, token, 'PATCH', { unread: true });
    await customer.goto(
      app.base + '/notifications',
      'Profile requests, review decisions and your notification history.',
    );
    const row = `main [data-notification-id="${id}"]`;
    await waitFor(
      () => customer.evaluate(`document.querySelector('${row}')?.dataset.unread==='true'`),
      'Unread notification row',
    );
    await customer.text(message);
    assert(
      await customer.evaluate(
        `(()=>{const row=document.querySelector('${row}');const name=row.querySelector('[data-notification-name]');const time=row.querySelector('time');const badge=row.querySelector('.notification-open>span:first-child>span:last-child');return parseInt(getComputedStyle(name).fontWeight)>=700&&Math.abs(name.getBoundingClientRect().left-time.getBoundingClientRect().left)<2&&badge.getBoundingClientRect().right>name.getBoundingClientRect().right&&time.getBoundingClientRect().top>=name.getBoundingClientRect().top})()`,
      ),
    );
    const point = await customer.evaluate<{ x: number; y: number }>(
      `(()=>{const r=document.querySelector('${row}>button').getBoundingClientRect();return {x:r.x+30,y:r.y+20}})()`,
    );
    await customerPage.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await waitFor(
      () =>
        customer.evaluate(`getComputedStyle(document.querySelector('${row}>button')).scale==='1'`),
      'Steady notification text on hover',
    );
    await customer.click(`${row} button[aria-label="Mark as Read"]`);
    await waitFor(
      () => customer.evaluate(`document.querySelector('${row}')?.dataset.unread==='false'`),
      'Read row and swapped action',
    );
    assert(
      await customer.evaluate(
        `parseInt(getComputedStyle(document.querySelector('${row} [data-notification-name]')).fontWeight)===400`,
      ),
    );
    assert.equal(
      (await api<{ notification: ProfileChange }>(`/notifications/${id}`, token)).notification
        .unread,
      false,
    );
    await customer.click(`${row} button[aria-label="Mark as Unread"]`);
    await waitFor(
      () => customer.evaluate(`document.querySelector('${row}')?.dataset.unread==='true'`),
      'Marked unread again',
    );
    await customer.click(`${row}>button`);
    await customer.text('Profile Change Request');
    await waitFor(
      async () =>
        !(await api<{ notification: ProfileChange }>(`/notifications/${id}`, token)).notification
          .unread,
      'Opening modal persists read status',
    );
    assert(
      !(await customer.evaluate(
        "[...document.querySelectorAll('dialog[open] button')].some(el=>['Approve','Reject'].includes(el.textContent.trim()))",
      )),
    );
    await customer.text(app.user.email);
    await customer.button('Cancel');
    const popup = '[role="dialog"][aria-label="Notifications"]';
    await customer.click('button[aria-label^="Notifications,"]');
    await customer.click(
      `${popup} [data-notification-id="${id}"] button[aria-label="Remove from Dropdown"]`,
    );
    await waitFor(
      () => customer.evaluate(`!document.querySelector('${popup} [data-notification-id="${id}"]')`),
      'Dismissed from dropdown',
    );
    assert(
      (await api<NotificationPage>('/notifications', token)).notifications.some(
        (item) => item.id === id,
      ),
    );
    assert(
      !(await api<NotificationPage>('/notifications?view=dropdown', token)).notifications.some(
        (item) => item.id === id,
      ),
    );
    await customer.goto(
      app.base + '/notifications',
      'Profile requests, review decisions and your notification history.',
    );
    await customer.click(`${row}>button`);
    await customer.text('Profile Change Request');
    await customer.button('Cancel');
    await customer.click('button[aria-label^="Notifications,"]');
    await waitFor(
      () => customer.evaluate(`!!document.querySelector('${popup}')`),
      'Reopened persisted dropdown',
    );
    assert(
      !(await customer.evaluate(
        `!!document.querySelector('${popup} [data-notification-id="${id}"]')`,
      )),
    );
    await customer.click('button[aria-label^="Notifications,"]');
  }

  await customer.goto(app.base + '/account', 'Welcome Back');
  await customer.fill('#customer-login-email', 'customer@example.test');
  await customer.fill('#customer-login-password', app.password);
  await customer.button('Sign In');
  await customer.completeOtp('customer@example.test');
  await customer.text('My Order History');
  const signedInCustomer = await customer.evaluate<string>("localStorage.getItem('ktd_token')");
  await checkNotificationInteractions(
    approvedId,
    signedInCustomer,
    'Your profile changes were approved and applied.',
  );
  pass(
    'Customer notifications have aligned rows, bold unread copy, steady hover, durable read toggles and dropdown-only dismissal',
  );

  await customer.click('button[aria-labelledby="notification-status-label"]');
  await customer.click('[role="option"]:nth-of-type(2)');
  assert(!(await customer.evaluate("location.search.includes('PENDING')")));
  await customer.button('Filter');
  await customer.text('No Notifications');
  await customer.click('button[aria-labelledby="notification-status-label"]');
  assert(
    await customer.evaluate(
      `(()=>{const option=document.querySelector('[role="option"]:nth-of-type(4)');const r=option.getBoundingClientRect();return document.elementFromPoint(r.x+10,r.y+r.height/2)?.closest('[role="option"]')===option})()`,
    ),
  );
  await customer.click('[role="option"]:first-of-type');
  await customer.button('Filter');
  await customer.fill('#notifications-q', 'no-matching-notification');
  await customer.button('Search');
  await customer.text('No notifications match these filters.');
  assert(
    await customer.evaluate(
      "location.search.includes('q=no-matching-notification')&&Math.abs(document.querySelector('#notifications-q').getBoundingClientRect().width-360)<2",
    ),
  );
  assert(
    await customer.evaluate(
      "getComputedStyle(document.querySelector('button[aria-label=\"Clear Search\"]')).cursor==='pointer'",
    ),
  );
  await customer.click('button[aria-label="Clear Search"]');
  await customer.fill('#notifications-q', 'apartment');
  await customer.button('Search');
  await waitFor(
    () =>
      customer.evaluate(
        `document.querySelectorAll('main [data-notification-id]').length===1&&!!document.querySelector('main [data-notification-id="${rejectedId}"]')`,
      ),
    'Feedback search',
  );
  pass(
    'Notification Filter/Search use shareable URLs, 360px inputs, custom clear actions and visible dropdowns over empty results',
  );

  await openAccountMenu();
  await customer.button('Sign Out');
  await customer.goto(app.base + '/account', 'Welcome Back');
  await customer.fill('#customer-login-email', 'courier@example.test');
  await customer.fill('#customer-login-password', app.password);
  await customer.button('Sign In');
  await customer.completeOtp('courier@example.test');
  await customer.text('Available Deliveries');
  const courierToken = await customer.evaluate<string>("localStorage.getItem('ktd_token')");
  const courierProfile = await api<ProfileResponse>('/profile', courierToken);
  const courierChange = await api<{ change: ProfileChange }>('/profile', courierToken, 'PATCH', {
    name: courierProfile.user.name,
    phone: courierProfile.user.phone || '',
    address: 'Courier notification address, apartment 37',
    expectedProfileVersion: courierProfile.user.profileVersion ?? 0,
  });
  await customer.goto(
    app.base + '/notifications',
    'Your profile changes are awaiting administrator review.',
  );
  assert(
    !(await customer.evaluate(
      `!!document.querySelector('main [data-notification-id="${approvedId}"]')`,
    )),
  );
  await openAdminNotification(courierChange.change.id);
  await admin.button('Approve');
  await admin.text('Approved');
  await admin.button('Cancel');
  await checkNotificationInteractions(
    courierChange.change.id,
    courierToken,
    'Your profile changes were approved and applied.',
  );
  pass(
    'Courier notifications are account-scoped with role-appropriate messages and customer-equivalent read/dismiss actions',
  );

  for (let index = 0; index < 5; index++) {
    const fixture = await registerFixture(
      `notification-${index}@example.test`,
      `Notification Fixture ${index}`,
    );
    await api('/profile', fixture.accessToken, 'PATCH', {
      name: `Notification Fixture ${index}`,
      phone: '555-1234',
      address: 'Scrollbar fixture address',
      expectedProfileVersion: fixture.user.profileVersion ?? 0,
    });
  }
  await admin.click('button[aria-label^="Notifications,"]');
  await admin.text('Review the requested profile changes.');
  await waitFor(
    () =>
      admin.evaluate(
        "document.querySelector('.notification-scroll')?.scrollHeight>document.querySelector('.notification-scroll')?.clientHeight",
      ),
    'Scrollable admin notification dropdown',
  );
  assert(
    await admin.evaluate(
      "(()=>{const region=document.querySelector('.notification-scroll');region.scrollTop=24;const scrolled=region.scrollTop>0;region.scrollTop=0;return scrolled})()",
    ),
  );
  const latest = (await api<NotificationPage>('/notifications?view=dropdown', app.token))
    .notifications[0]!;
  assert.equal(
    await admin.evaluate(
      "document.querySelector('.notification-scroll [data-notification-id]')?.dataset.notificationId",
    ),
    latest.id,
  );
  await adminPage
    .send('Page.captureScreenshot', { format: 'png' })
    .then((capture) =>
      writeFile(join(directory, 'notifications-dropdown.png'), Buffer.from(capture.data, 'base64')),
    );
  const iconPoint = await admin.evaluate<{ x: number; y: number }>(
    `(()=>{const r=document.querySelector('.notification-scroll [data-notification-id="${latest.id}"] button[aria-label="Remove from Dropdown"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  );
  await adminPage.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...iconPoint });
  await waitFor(
    () =>
      admin.evaluate(
        "[...document.querySelectorAll('[role=tooltip]')].some(el=>el.textContent.includes('Remove from Dropdown'))",
      ),
    'Dismiss action tooltip',
  );
  await admin.click('button[aria-label^="Notifications,"]');
  if (!(await admin.evaluate("document.documentElement.classList.contains('dark')")))
    await admin.click('button[aria-label="Switch to Dark Mode"]');
  await admin.click('button[aria-label^="Notifications,"]');
  await waitFor(
    () =>
      admin.evaluate(
        "getComputedStyle(document.querySelector('.notification-scroll')).scrollbarColor.includes('rgb(45, 212, 191)')",
      ),
    'Dark notification scrollbar',
  );
  await waitFor(
    () => admin.evaluate("!document.documentElement.matches(':active-view-transition')"),
    'Theme animation settles before the dark screenshot',
  );
  await adminPage
    .send('Page.captureScreenshot', { format: 'png' })
    .then((capture) =>
      writeFile(
        join(directory, 'notifications-dropdown-dark.png'),
        Buffer.from(capture.data, 'base64'),
      ),
    );
  pass(
    'Admin notifications show the newest event first with light/dark themed scrolling, icon tooltips and review-specific copy',
  );
  await admin.click('button[aria-label^="Notifications,"]');
  await admin.click('button[aria-label="Open Account Menu"]');
  await settleVisuals(adminPage);
  await writeFile(
    join(directory, 'account-dropdown-dark.png'),
    Buffer.from((await adminPage.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'),
  );
  assert.deepEqual(errors, [], 'Browser runtime errors');
  console.log(
    `Verified ${checks.length} profile/receipt scenarios. Screenshots and receipt: ${directory}`,
  );
} catch (error) {
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index]!;
    const diagnostic = await page
      .evaluate<string>(
        "JSON.stringify({url:location.href,text:document.body.textContent.slice(-5000),dialogs:[...document.querySelectorAll('dialog[open]')].map(el=>el.textContent)})",
      )
      .catch(() => 'Unavailable');
    console.log(`Page ${index}: ${diagnostic}`);
    const image = await page
      .send('Page.captureScreenshot', { format: 'png' })
      .catch(() => undefined);
    if (image)
      await writeFile(join(directory, `failure-${index}.png`), Buffer.from(image.data, 'base64'));
  }
  console.log(`Browser artifacts: ${directory}`);
  throw error;
} finally {
  await Promise.all(pages.map((page) => page.dispose().catch(() => undefined)));
  await customerBrowser?.close();
  await adminBrowser?.close();
  await runtime.close();
}
