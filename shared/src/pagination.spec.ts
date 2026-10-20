import { describe, expect, it } from 'vitest';
import { paginate, PageNumberSchema, PageSizeSchema } from './pagination.js';

describe('Pagination boundaries', () => {
  it('keeps an empty result on an accessible first page', () => {
    expect(paginate(0, 9, 10)).toEqual({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  });
  it('clamps a page when filters or deletions shorten the results', () => {
    expect(paginate(26, 8, 25)).toEqual({ page: 2, pageSize: 25, total: 26, totalPages: 2 });
  });
  it.each([10, 25, 50, 100])('accepts the %i-item page option', (size) => {
    expect(PageSizeSchema.parse(String(size))).toBe(size);
  });
  it.each(['0', '-1', '1.5', 'nope', '1000001'])('rejects unsafe page %s', (page) => {
    expect(PageNumberSchema.safeParse(page).success).toBe(false);
  });
});
