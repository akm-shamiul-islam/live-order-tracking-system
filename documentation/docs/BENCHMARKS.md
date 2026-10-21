# HTTP throughput benchmark

Run a complete production build, then run:

```bash
pnpm build
pnpm benchmark:throughput
```

The command starts its own MongoDB with synthetic accounts/orders and two separate Node processes. It never targets the development API or database. Fastify is the application adapter; Express is installed only as a comparison fixture.

## Method

Both adapters use the same compiled AppModule, authentication/database checks, validation, response interceptor, metrics, high test-only rate budgets, MongoDB fixture and equivalent Helmet/CORS policies. A same-host Autocannon process sends sequential closed-loop HTTP GET loads. Each recorded run has a separate warmup. The first adapter alternates by repetition to reduce ordering bias. Any errors, timeouts or non-2xx responses invalidate a run. Response preflight checks ensure that useful application payloads are returned.

Default settings:

| Setting | Default |
| --- | --- |
| Concurrent connections | 25 |
| Pipelining | 1 |
| Warmup per run | 3 seconds |
| Recorded duration per run | 10 seconds |
| Repetitions per adapter/workload | 3 |
| Synthetic orders | 100 |
| Client timeout | 10 seconds |

Workloads are public configuration without a database lookup, an authenticated private order with MongoDB, and an authenticated dispatch page returning ten orders. Results record each run, median requests/second, medians of run latency percentiles, hardware, package versions, source revision and whether the working tree was dirty.

BENCH_CONNECTIONS, BENCH_PIPELINING, BENCH_TIMEOUT_SECONDS, BENCH_DURATION_SECONDS, BENCH_WARMUP_SECONDS, BENCH_REPEATS, BENCH_FIXTURE_ORDERS and BENCH_RATE_LIMIT_MAX override defaults. BENCH_OUTPUT changes the JSON destination. These are benchmark-only process variables; normal API rate limits remain unchanged.

## Reference results

Measured 2026-10-21T01:09:21.193Z from committed revision `83353a91b9f0d28ffdde15da14b7ab362f787fca`, with a clean working tree.

Intel(R) Core(TM) i7-8665U CPU @ 1.90GHz; 8 logical CPUs, 15.81 GiB RAM, Windows 11 Pro (x64). Node v24.18.1, pnpm 12.14.0, NestJS 12.2.0, Fastify 5.12.7, Express 5.3.0, MongoDB 8.2.6 and Autocannon 8.0.0.

| Workload | Fastify req/s | Express req/s | Fastify p99 (ms) | Express p99 (ms) |
| --- | ---: | ---: | ---: | ---: |
| Public configuration | 1,095.41 | 1,210.60 | 51 | 67 |
| Private order with MongoDB | 141.20 | 153.31 | 298 | 233 |
| Authenticated dispatch page (10 orders) | 67.50 | 70.41 | 919 | 659 |

| Workload | Adapter | Median req/s | Median run p50 (ms) | Median run p99 (ms) |
| --- | --- | ---: | ---: | ---: |
| Public configuration | fastify | 1,095.41 | 20 | 51 |
| Public configuration | express | 1,210.60 | 14 | 67 |
| Private order with MongoDB | fastify | 141.20 | 177 | 298 |
| Private order with MongoDB | express | 153.31 | 160 | 233 |
| Authenticated dispatch page (10 orders) | fastify | 67.50 | 319 | 919 |
| Authenticated dispatch page (10 orders) | express | 70.41 | 316 | 659 |

25 concurrent connections, pipelining 1, three 10-second recorded runs per adapter/workload, each after a 3-second warmup. Same compiled application/security checks and isolated MongoDB with 100 synthetic orders; HTTP on loopback without TLS. All 18 recorded runs completed with zero errors, timeouts or non-2xx responses. Express returned higher median throughput for these workloads; Fastify/Express request-rate ratios were 0.905, 0.921, 0.959, respectively. This result does not justify a general speed claim about either adapter.

[Raw JSON: all 18 runs, settings and environment](../benchmarks/throughput-2026-10-21.json).

## Interpretation

These are local application measurements, including middleware, authentication and database costs. They are not a universal framework speed claim. There is no TLS/proxy/network emulation, write load, sustained socket flood or multi-instance topology in this comparison. Latency values are medians of per-run percentiles, not percentiles of a merged histogram. Repeat on the intended production hardware/database/proxy before capacity planning, with a representative traffic mix and resource monitoring.

See the [Autocannon maintainer API](https://github.com/mcollina/autocannon) and [Fastify benchmark guidance](https://fastify.dev/benchmarks/). Benchmark tools and current API compatibility are documented in [DEPENDENCIES.md](DEPENDENCIES.md).
