import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep, basename } from 'node:path';
import type { ProtocolMapping } from 'devtools-protocol/types/protocol-mapping.js';
import { parseJson, responseJson } from './json.ts';

interface PendingCommand {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface CdpMessage {
  id?: number;
  error?: { message: string };
  result?: unknown;
  method?: string;
  params?: unknown;
}

interface BrowserVersion {
  Browser: string;
  webSocketDebuggerUrl: string;
}

interface BrowserTarget {
  id: string;
  webSocketDebuggerUrl: string;
}

export async function connectCdp(url: string) {
  const ws = new WebSocket(url);
  const pending = new Map<number, PendingCommand>();
  const listeners = new Map<string, ((params: unknown) => void)[]>();
  let id = 0;
  await once(ws, 'open');
  ws.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') return;
    const message = parseJson<CdpMessage>(event.data);
    if (message.id) {
      const task = pending.get(message.id);
      if (!task) return;
      pending.delete(message.id);
      clearTimeout(task.timer);
      if (message.error) task.reject(new Error(message.error.message));
      else task.resolve(message.result);
    } else if (message.method)
      for (const listener of listeners.get(message.method) || []) listener(message.params);
  });
  const send = <Method extends keyof ProtocolMapping.Commands>(
    method: Method,
    ...args: ProtocolMapping.Commands[Method]['paramsType']
  ): Promise<ProtocolMapping.Commands[Method]['returnType']> =>
    new Promise((resolveResult, reject) => {
      const next = ++id;
      const timer = setTimeout(() => {
        pending.delete(next);
        reject(new Error(`CDP timed out: ${method}`));
      }, 20_000);
      pending.set(next, {
        resolve: (result) =>
          resolveResult(result as ProtocolMapping.Commands[Method]['returnType']),
        reject,
        timer,
      });
      ws.send(JSON.stringify({ id: next, method, params: args[0] ?? {} }));
    });
  return {
    send,
    on<Method extends keyof ProtocolMapping.Events>(
      method: Method,
      listener: (params: ProtocolMapping.Events[Method][0]) => void,
    ) {
      const dispatch = (params: unknown) => listener(params as ProtocolMapping.Events[Method][0]);
      listeners.set(method, [...(listeners.get(method) || []), dispatch]);
    },
    async evaluate<T = unknown>(expression: string): Promise<T> {
      const result = await send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      });
      if (result.exceptionDetails)
        throw new Error(
          result.exceptionDetails.exception?.description || result.exceptionDetails.text,
        );
      const value: unknown = result.result.value;
      return value as T;
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

async function chromePath(): Promise<string> {
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
  let port: number | undefined;
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
  const version = await responseJson<BrowserVersion>(await fetch(`${endpoint}/json/version`));
  async function page(url: string) {
    const target = await responseJson<BrowserTarget>(
      await fetch(`${endpoint}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' }),
    );
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

export type Browser = Awaited<ReturnType<typeof launchBrowser>>;
export type BrowserPage = Awaited<ReturnType<Browser['page']>>;

export async function waitFor(
  check: () => unknown,
  message = 'Browser condition',
  timeout = 15_000,
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
  }
  throw new Error(`${message} timed out.`);
}
