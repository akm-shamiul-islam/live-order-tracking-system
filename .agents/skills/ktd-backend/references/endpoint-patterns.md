# KitchenToDoor: Backend Controller, Service & Schema Reference Patterns

This document details canonical implementation patterns for NestJS modules, schemas, services, and tests in KitchenToDoor.

---

## 1. Mongoose Schema Definition Pattern

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, type Types } from 'mongoose';

export type ExampleDocument = Example & Document;

@Schema({ timestamps: true, collection: 'examples' })
export class Example {
  @Prop({ type: String, required: true, unique: true, index: true, trim: true })
  code: string;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true })
  status: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  assignedTo?: Types.ObjectId | null;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, unknown>;
}

export const ExampleSchema = SchemaFactory.createForClass(Example);
ExampleSchema.index({ status: 1, createdAt: -1 });
```

---

## 2. Paginated Query Implementation Pattern

```typescript
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Example, ExampleDocument } from '../database/schemas/example.schema.js';
import { getRuntimeSettings } from '../config/runtime-settings.js';

@Injectable()
export class ExampleService {
  constructor(@InjectModel(Example.name) private readonly exampleModel: Model<ExampleDocument>) {}

  private buildFilter(status?: string, search?: string) {
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (search) {
      const sanitized = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { code: { $regex: sanitized, $options: 'i' } },
        { name: { $regex: sanitized, $options: 'i' } },
      ];
    }
    return filter;
  }

  async count(status?: string, search?: string): Promise<number> {
    return this.exampleModel.countDocuments(this.buildFilter(status, search));
  }

  async getPage(
    status?: string,
    search?: string,
    page = 1,
    limit = getRuntimeSettings().ORDER_LIST_DEFAULT_LIMIT,
  ): Promise<ExampleDocument[]> {
    const query = this.exampleModel
      .find(this.buildFilter(status, search))
      .sort({ createdAt: -1, _id: -1 });

    if (page > 1) {
      query.skip((page - 1) * limit);
    }

    return query.limit(limit);
  }
}
```

---

## 3. Fastify Response & Error Handling

Fastify handles status codes and streaming responses cleanly:

- Use standard NestJS HTTP exceptions (`BadRequestException`, `UnauthorizedException`, `ForbiddenException`, `NotFoundException`, `ConflictException`, `ServiceUnavailableException`).
- `ZodValidationPipe` formats schema issues into `{ message: 'Validation failed', errors: [{ field, message }] }` with status 400.
- For 429 rate limit errors, Fastify injects a `Retry-After` header. Frontend `api.ts` parses this header to provide human-readable countdown messages.
