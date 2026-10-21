import { type ArgumentsHost, Catch, Inject, type ExceptionFilter } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import mongoose, { mongo } from 'mongoose';

@Catch(
  mongoose.Error,
  mongo.MongoNetworkError,
  mongo.MongoServerSelectionError,
  mongo.MongoOperationTimeoutError,
)
export class DatabaseExceptionFilter implements ExceptionFilter {
  constructor(@Inject(HttpAdapterHost) private readonly adapters: HttpAdapterHost) {}

  catch(error: Error, host: ArgumentsHost) {
    const status = error instanceof mongoose.Error.ValidationError ? 400 : 503;
    this.adapters.httpAdapter.reply(
      host.switchToHttp().getResponse(),
      {
        statusCode: status,
        message:
          status === 400
            ? 'The request could not be saved. Please check your details.'
            : 'The order service is temporarily unavailable. Please try again shortly.',
      },
      status,
    );
  }
}
