import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';

export async function connectCdp(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  const listeners = new Map();
  let id = 0;
  await once(ws, 'open');
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id);
      if (!task) return;
      pending.delete(message.id);
      clearTimeout(task.timer);
      if (message.error) task.reject(new Error(message.error.message));
      else task.resolve(message.result);
    } else for (const listener of listeners.get(message.method) || []) listener(message.params);
  });
  const send = (method, params = {}) =>
    new Promise((resolveResult, reject) => {
      const next = ++id;
      const timer = setTimeout(() => {
        pending.delete(next);
        reject(new Error(`CDP timed out: ${method}`));
      }, 20_000);
      pending.set(next, { resolve: resolveResult, reject, timer });
      ws.send(JSON.stringify({ id: next, method, params }));
    });
  return {
    send,
    on(method, listener) {
      listeners.set(method, [...(listeners.get(method) || []), listener]);
    },
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.exceptionDetails)
        throw new Error(
          result.exceptionDetails.exception?.description || result.exceptionDetails.text,
        );
      return result.result.value;
    },
    close() {
      for (const task of pending.values()) {
        clearTimeout(task.timer);
        task.reject(new Error('CDP closed'));
      }
      pending.clear();
      ws.close();
    },
  };
}

async function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const installed = [
    join(process.env.PROGRAMFILES || '', 'Google/Chrome/Application/chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] || '', 'Google/Chrome/Application/chrome.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ];
  for (const path of installed) if (existsSync(path)) return path;
  const cache = join(tmpdir(), 'ktd-chrome-for-testing', 'chrome');
  if (existsSync(cache)) {
    const versions = (await readdir(cache)).sort((a, b) =>
      b.localeCompare(a, 'en', { numeric: true }),
    );
    for (const version of versions) {
      const path = join(cache, version, 'chrome-win64/chrome.exe');
      if (existsSync(path)) return path;
    }
  }
  throw new Error(
    'Set CHROME_PATH to Chrome or install Chrome for Testing as described in the quality guide.',
  );
}

export async function launchBrowser() {
  const profile = await mkdtemp(join(tmpdir(), 'ktd-chrome-audit-'));
  const browser = spawn(
    await chromePath(),
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
  );
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]);
      break;
    } catch {}
    if (browser.exitCode !== null)
      throw new Error('Chrome stopped before its debugging port became available.');
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  if (!port) {
    browser.kill();
    throw new Error('Chrome startup timed out.');
  }
  const endpoint = `http://127.0.0.1:${port}`;
  const version = await (await fetch(`${endpoint}/json/version`)).json();
  async function page(url) {
    const target = await (
      await fetch(`${endpoint}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })
    ).json();
    const cdp = await connectCdp(target.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    return {
      ...cdp,
      async dispose() {
        cdp.close();
        await fetch(`${endpoint}/json/close/${target.id}`);
      },
    };
  }
  async function close() {
    if (browser.exitCode === null && browser.signalCode === null) {
      const exited = once(browser, 'exit');
      const cdp = await connectCdp(version.webSocketDebuggerUrl);
      const timeout = setTimeout(() => browser.kill(), 5000);
      await cdp.send('Browser.close').catch(() => undefined);
      cdp.close();
      await exited.finally(() => clearTimeout(timeout));
    }
    const absolute = resolve(profile);
    if (
      !absolute.startsWith(resolve(tmpdir()) + sep) ||
      !basename(absolute).startsWith('ktd-chrome-audit-')
    )
      throw new Error('Refusing to remove an unexpected browser profile path.');
    await rm(absolute, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  }
  return { port, version: version.Browser, page, close };
}

export async function waitFor(check, message = 'Browser condition', timeout = 15_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`${message} timed out.`);
}
