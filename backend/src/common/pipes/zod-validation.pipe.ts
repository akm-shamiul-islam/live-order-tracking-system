import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema | (() => ZodSchema)) {}

  transform(value: unknown) {
    try {
      const schema = typeof this.schema === 'function' ? this.schema() : this.schema;
      return schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          success: false,
          message: 'Validation failed',
          errors: error.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
