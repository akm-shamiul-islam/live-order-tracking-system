import lighthouse from 'lighthouse';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createIsolatedRuntime } from '../backend/scripts/isolated-runtime.ts';
import { launchBrowser, waitFor, type Browser } from './lib/browser.ts';
import { packageVersion } from './lib/json.ts';
const require = createRequire(import.meta.url);

const runtime = await createIsolatedRuntime({ count: 12, serveFrontend: true });
let browser: Browser | undefined;

function selectorsIn(item: unknown): string[] {
  if (!item || typeof item !== 'object') return [];
  if (
    'node' in item &&
    item.node &&
    typeof item.node === 'object' &&
    'selector' in item.node &&
    typeof item.node.selector === 'string'
  )
    return [item.node.selector];
  if (
    'subItems' in item &&
    item.subItems &&
    typeof item.subItems === 'object' &&
    'items' in item.subItems &&
    Array.isArray(item.subItems.items)
  )
    return item.subItems.items.flatMap((child: unknown) => selectorsIn(child));
  return [];
}
try {
  const app = await runtime.start();
  browser = await launchBrowser();
  const seed = await browser.page(app.base);
  await waitFor(() => seed.evaluate('Boolean(document.querySelector("main h1"))'), 'Initial menu');
  await seed.evaluate('localStorage.setItem("kitchentodoor.navigation.open", "false")');
  const cases = [
    { name: 'menu-mobile', path: '/', mobile: true },
    { name: 'menu-desktop', path: '/', mobile: false },
    { name: 'account-mobile', path: '/account/register', mobile: true, private: true },
    { name: 'orders-mobile', path: '/orders', mobile: true, account: 'customer', private: true },
    {
      name: 'tracking-mobile',
      path: `/tracking/${app.trackingId}`,
      mobile: true,
      account: 'customer',
      private: true,
    },
    {
      name: 'dispatch-desktop',
      path: '/dispatch',
      mobile: false,
      account: 'dispatcher',
      private: true,
    },
    { name: 'users-desktop', path: '/users', mobile: false, account: 'dispatcher', private: true },
    { name: 'courier-mobile', path: '/courier', mobile: true, account: 'courier', private: true },
  ];
  const directory = await mkdtemp(join(tmpdir(), 'ktd-lighthouse-reports-'));
  const results = [];
  const requestedPages = process.env.LIGHTHOUSE_PAGES?.split(',');
  const selectedCases = requestedPages
    ? cases.filter((test) => requestedPages.includes(test.name))
    : cases;
  for (const test of selectedCases) {
    if (test.account) {
      const status = await seed.evaluate(
        `(async()=>{ const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:${JSON.stringify(`${test.account}@example.test`)},password:${JSON.stringify(app.password)}})}); const data=await response.json(); if(response.ok){localStorage.setItem('ktd_token',data.accessToken);localStorage.setItem('ktd_user',JSON.stringify(data.user));} return response.status;})()`,
      );
      if (status !== 200) throw new Error('Audit account sign-in failed.');
    }
    await seed.send('Network.enable');
    await seed.send('Network.clearBrowserCache');
    console.log(`Auditing ${test.name} with ${browser.version}…`);
    const flags: NonNullable<Parameters<typeof lighthouse>[1]> = {
      port: browser.port,
      logLevel: 'error',
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      output: ['json', 'html'],
      disableStorageReset: true,
    };
    if (!test.mobile)
      Object.assign(flags, {
        formFactor: 'desktop',
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false,
        },
        throttling: {
          rttMs: 40,
          throughputKbps: 10_240,
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0,
        },
      });
    let report = await lighthouse(app.base + test.path, flags);
    if (!report) throw new Error(`Lighthouse returned no report for ${test.name}.`);
    if (report.lhr.runtimeError?.code === 'NO_NAVSTART') {
      console.log(
        'Chrome omitted navigation timing from the trace; retrying trace collection once.',
      );
      await seed.send('Network.clearBrowserCache');
      report = await lighthouse(app.base + test.path, flags);
      if (!report) throw new Error(`Lighthouse returned no report for ${test.name}.`);
    }
    if (report.lhr.runtimeError) throw new Error(report.lhr.runtimeError.message);
    const [jsonReport, htmlReport] = Array.isArray(report.report) ? report.report : [];
    if (!jsonReport || !htmlReport)
      throw new Error(`Lighthouse did not generate both reports for ${test.name}.`);
    await writeFile(join(directory, `${test.name}.json`), jsonReport);
    await writeFile(join(directory, `${test.name}.html`), htmlReport);
    const issues = Object.values(report.lhr.audits)
      .filter(
        (audit) =>
          audit.score !== null && audit.score < 1 && audit.scoreDisplayMode !== 'informative',
      )
      .map((audit) => ({
        id: audit.id,
        title: audit.title,
        score: audit.score,
        displayValue: audit.displayValue,
        selectors:
          audit.details && 'items' in audit.details && Array.isArray(audit.details.items)
            ? audit.details.items.flatMap((item: unknown) => selectorsIn(item)).slice(0, 12)
            : undefined,
      }));
    const result = {
      page: test.name,
      private: Boolean(test.private),
      scores: Object.fromEntries(
        Object.entries(report.lhr.categories).map(([key, value]) => [
          key,
          value.score === null ? null : Math.round(value.score * 100),
        ]),
      ),
      metrics: Object.fromEntries(
        [
          'first-contentful-paint',
          'largest-contentful-paint',
          'total-blocking-time',
          'cumulative-layout-shift',
          'speed-index',
        ].map((key) => [key, report.lhr.audits[key]?.numericValue]),
      ),
      issues,
    };
    results.push(result);
    console.log(JSON.stringify(result));
  }
  await seed.dispose();
  const measuredAt = new Date().toISOString();
  const output = resolve(
    process.env.LIGHTHOUSE_OUTPUT ||
      `documentation/quality/lighthouse-${measuredAt.slice(0, 10)}.json`,
  );
  await mkdir(resolve(output, '..'), { recursive: true });
  await writeFile(
    output,
    JSON.stringify(
      {
        measuredAt,
        chrome: browser.version,
        lighthouse: packageVersion(require, 'lighthouse'),
        method:
          'Compiled production app and compressed local assets, isolated synthetic MongoDB, Chrome for Testing, cold HTTP cache per navigation, drawer dismissed using its persisted preference. Mobile Lighthouse simulation; desktop 40ms RTT/10Mbps/1x CPU.',
        limitations: [
          'Private pages deliberately use noindex; their crawlability warning is expected.',
          'Local HTTP cannot establish the deployed site’s TLS, HSTS, infrastructure security or real-world field performance.',
          'Lighthouse automated accessibility checks do not replace keyboard and assistive-technology testing or a security review.',
        ],
        results,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`Saved summary: ${output}\nFull local reports: ${directory}`);
} finally {
  await browser?.close();
  await runtime.close();
}
