import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { cpus, totalmem, version as osVersion, release, arch } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createIsolatedRuntime } from '../backend/scripts/isolated-runtime.ts';
import type { RuntimeAdapter } from '../backend/scripts/runtime-contracts.ts';
import type { OrderDetails } from '../shared/src/index.ts';
import type Autocannon from 'autocannon';
import { packageVersion, responseJson } from './lib/json.ts';

const require = createRequire(new URL('../backend/package.json', import.meta.url));
const autocannon = require('autocannon') as typeof Autocannon;
const numberOption = (name: string, fallback: number): number => {
  const value = Number(process.env[name] || fallback);
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error(`${name} must be a positive integer.`);
  return value;
};
const settings = {
  connections: numberOption('BENCH_CONNECTIONS', 25),
  pipelining: numberOption('BENCH_PIPELINING', 1),
  timeout: numberOption('BENCH_TIMEOUT_SECONDS', 10),
  duration: numberOption('BENCH_DURATION_SECONDS', 10),
  warmup: numberOption('BENCH_WARMUP_SECONDS', 3),
  repeats: numberOption('BENCH_REPEATS', 3),
  fixtureOrders: numberOption('BENCH_FIXTURE_ORDERS', 100),
  rateLimit: numberOption('BENCH_RATE_LIMIT_MAX', 1_000_000),
};
const runtime = await createIsolatedRuntime({
  count: settings.fixtureOrders,
  rateLimit: settings.rateLimit,
});
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  if (upper === undefined) throw new Error('Cannot summarize an empty measurement.');
  if (sorted.length % 2) return upper;
  const lower = sorted[middle - 1];
  if (lower === undefined) throw new Error('The measurement median is incomplete.');
  return (lower + upper) / 2;
};
interface Measurement {
  workload: string;
  adapter: RuntimeAdapter;
  repetition: number;
  requestsPerSecond: number;
  latencyP50Ms: number;
  latencyP99Ms: number;
  bytesPerSecond: number;
  completed: number;
  errors: number;
  timeouts: number;
  non2xx: number;
  durationSeconds: number;
}
interface WorkloadBody {
  pricing?: { deliveryFee: number; taxRate: number };
  order?: OrderDetails;
  orders?: OrderDetails[];
  pagination?: { total: number };
}
const runs: Measurement[] = [];

function measure(url: string, headers: Record<string, string>, duration: number) {
  return new Promise<Autocannon.Result>((resolveResult, reject) =>
    autocannon(
      {
        url,
        headers,
        duration,
        connections: settings.connections,
        pipelining: settings.pipelining,
        timeout: settings.timeout,
      },
      (error, result) => {
        if (error) return reject(error);
        if (result.errors || result.timeouts || result.non2xx || !result['2xx']) {
          return reject(
            new Error(
              `Invalid measurement: ${result.errors} errors, ${result.timeouts} timeouts, ${result.non2xx} non-2xx responses.`,
            ),
          );
        }
        resolveResult(result);
      },
    ),
  );
}

try {
  console.log('Starting isolated MongoDB and two production Nest HTTP adapters.');
  const fastify = await runtime.start('fastify');
  const express = await runtime.start('express');
  const servers = { fastify, express };
  const workloads: {
    name: string;
    path: string;
    protected: boolean;
    valid: (body: WorkloadBody) => boolean;
  }[] = [
    {
      name: 'Public configuration',
      path: '/api/config',
      protected: false,
      valid: (body) =>
        Number.isFinite(body.pricing?.deliveryFee) && Number.isFinite(body.pricing?.taxRate),
    },
    {
      name: 'Private order with MongoDB',
      path: `/api/orders/${fastify.trackingId}`,
      protected: true,
      valid: (body) => body.order?.id === fastify.orderId && body.order.statusHistory.length >= 1,
    },
    {
      name: 'Authenticated dispatch page (10 orders)',
      path: '/api/orders?page=1&limit=10',
      protected: true,
      valid: (body) =>
        body.orders?.length === Math.min(10, settings.fixtureOrders) &&
        body.pagination?.total === settings.fixtureOrders,
    },
  ];
  for (const workload of workloads) {
    const headers: Record<string, string> = workload.protected
      ? { Authorization: `Bearer ${fastify.token}` }
      : {};
    for (const [adapter, server] of Object.entries(servers)) {
      const response = await fetch(server.base + workload.path, { headers });
      const body = await responseJson<WorkloadBody>(response);
      if (response.status !== 200 || !workload.valid(body))
        throw new Error(`${adapter} preflight failed for ${workload.name}.`);
    }
    for (let iteration = 1; iteration <= settings.repeats; iteration++) {
      // Alternate the first adapter to reduce ordering, warmup and thermal bias.
      const order: RuntimeAdapter[] =
        iteration % 2 ? ['fastify', 'express'] : ['express', 'fastify'];
      for (const adapter of order) {
        const url = servers[adapter].base + workload.path;
        console.log(`${workload.name}: ${adapter}, repetition ${iteration}/${settings.repeats}`);
        await measure(url, headers, settings.warmup);
        const result = await measure(url, headers, settings.duration);
        runs.push({
          workload: workload.name,
          adapter,
          repetition: iteration,
          requestsPerSecond: result.requests.average,
          latencyP50Ms: result.latency.p50,
          latencyP99Ms: result.latency.p99,
          bytesPerSecond: result.throughput.average,
          completed: result['2xx'],
          errors: result.errors,
          timeouts: result.timeouts,
          non2xx: result.non2xx,
          durationSeconds: result.duration,
        });
      }
    }
  }
  const summaries = workloads.map(({ name }) => {
    const summarize = (adapter: RuntimeAdapter) => {
      const samples = runs.filter((run) => run.workload === name && run.adapter === adapter);
      return {
        medianRequestsPerSecond: median(samples.map((run) => run.requestsPerSecond)),
        medianLatencyP50Ms: median(samples.map((run) => run.latencyP50Ms)),
        medianLatencyP99Ms: median(samples.map((run) => run.latencyP99Ms)),
      };
    };
    const fastifySummary = summarize('fastify');
    const expressSummary = summarize('express');
    return {
      workload: name,
      fastify: fastifySummary,
      express: expressSummary,
      fastifyRelativeToExpress: Number(
        (fastifySummary.medianRequestsPerSecond / expressSummary.medianRequestsPerSecond).toFixed(
          3,
        ),
      ),
    };
  });
  const report = {
    measuredAt: new Date().toISOString(),
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    workingTreeDirty: Boolean(
      execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
    ),
    hardware: {
      cpu: cpus()[0]?.model,
      logicalCpus: cpus().length,
      ramGiB: Number((totalmem() / 2 ** 30).toFixed(2)),
      os: osVersion(),
      kernel: release(),
      arch: arch(),
    },
    versions: {
      node: process.version,
      pnpm: process.env.npm_config_user_agent?.match(/^pnpm\/([\d.]+)/)?.[1] || null,
      ...fastify.versions,
      autocannon: packageVersion(require, 'autocannon'),
    },
    settings,
    summaries,
    runs,
    method:
      'Same compiled AppModule, guards, rate limiter, metrics and isolated MongoDB data; matching Helmet/CORS policies; separate Node adapter processes; sequential same-host load generator; no TLS; rates increased for this benchmark only.',
    limitations: [
      'Local development hardware with existing idle development processes, not a dedicated production host.',
      'Closed-loop HTTP GET workloads; results include middleware, authentication and database costs.',
      'No claim about internet latency, writes, multi-instance scaling or sustained WebSocket throughput.',
      'Reported latency percentiles are the medians of each run’s percentiles, not percentiles of a merged histogram.',
    ],
  };
  const output = resolve(
    process.env.BENCH_OUTPUT ||
      `documentation/benchmarks/throughput-${report.measuredAt.slice(0, 10)}.json`,
  );
  await mkdir(resolve(output, '..'), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.table(
    summaries.map((summary) => ({
      workload: summary.workload,
      fastifyReqSec: summary.fastify.medianRequestsPerSecond,
      expressReqSec: summary.express.medianRequestsPerSecond,
      ratio: summary.fastifyRelativeToExpress,
    })),
  );
  console.log(`Saved ${output}`);
} finally {
  await runtime.close();
}
