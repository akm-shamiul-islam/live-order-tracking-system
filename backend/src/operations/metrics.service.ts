import {
  Injectable,
  Inject,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import { finalize, tap } from 'rxjs';

type Metric = { requests: number; failures: number; totalMs: number; maxMs: number };

@Injectable()
export class MetricsService {
  private readonly handlers = new Map<string, Metric>();

  record(handler: string, elapsed: number, failed: boolean) {
    const metric = this.handlers.get(handler) ?? { requests: 0, failures: 0, totalMs: 0, maxMs: 0 };
    metric.requests++;
    metric.failures += Number(failed);
    metric.totalMs += elapsed;
    metric.maxMs = Math.max(metric.maxMs, elapsed);
    this.handlers.set(handler, metric);
  }

  snapshot() {
    return {
      uptimeSeconds: Math.floor(process.uptime()),
      rssBytes: process.memoryUsage().rss,
      handlers: Object.fromEntries(
        [...this.handlers].map(([handler, data]) => [
          handler,
          {
            requests: data.requests,
            failures: data.failures,
            averageMs: Math.round((data.totalMs / data.requests) * 100) / 100,
            maxMs: Math.round(data.maxMs * 100) / 100,
          },
        ]),
      ),
    };
  }
}

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(@Inject(MetricsService) private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();
    const started = performance.now();
    let failed = false;
    const handler = `${context.getClass().name}.${context.getHandler().name}`;
    return next.handle().pipe(
      tap({
        error: () => {
          failed = true;
        },
      }),
      finalize(() => this.metrics.record(handler, performance.now() - started, failed)),
    );
  }
}
