import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { ZodError, type ZodType } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodType | (() => ZodType)) {}

  transform(value: unknown) {
    try {
      const schema = typeof this.schema === 'function' ? this.schema() : this.schema;
      return schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          success: false,
          message: 'Validation failed',
          errors: error.issues.map((e) => ({
            field: e.path.map(String).join('.'),
            message: e.message,
          })),
        });
      }
      throw new BadRequestException('Validation failed');
    }
  }
}
