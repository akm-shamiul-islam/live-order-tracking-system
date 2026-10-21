import { z } from 'zod';

// Configure before constructing schemas. Browser CSP blocks eval; Node can retain normal JIT validation.
if (typeof window !== 'undefined') z.config({ jitless: true });

export { z };
