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

A complete measured reference is recorded after the final verification run. The README contains the concise adapter comparison; raw measurements are stored in documentation/benchmarks.

## Interpretation

These are local application measurements, including middleware, authentication and database costs. They are not a universal framework speed claim. There is no TLS/proxy/network emulation, write load, sustained socket flood or multi-instance topology in this comparison. Latency values are medians of per-run percentiles, not percentiles of a merged histogram. Repeat on the intended production hardware/database/proxy before capacity planning, with a representative traffic mix and resource monitoring.

See the [Autocannon maintainer API](https://github.com/mcollina/autocannon) and [Fastify benchmark guidance](https://fastify.dev/benchmarks/). Benchmark tools and current API compatibility are documented in [DEPENDENCIES.md](DEPENDENCIES.md).
