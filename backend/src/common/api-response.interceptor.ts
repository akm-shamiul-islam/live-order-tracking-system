import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() === 'http') {
      const response = context
        .switchToHttp()
        .getResponse<{ header(name: string, value: string): unknown }>();
      response.header('Cache-Control', 'no-store');
    }
    return next.handle();
  }
}
