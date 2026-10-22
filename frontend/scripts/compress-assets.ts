import { readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { promisify } from 'node:util';
import { gzip, brotliCompress } from 'node:zlib';

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);
const root = resolve(import.meta.dirname, '../dist');
async function compress(directory: string): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await compress(path);
    else if (/\.(?:m?js|css|svg|html)$/.test(entry.name)) {
      const data = await readFile(path);
      if (data.length < 1024) continue;
      const [gz, br] = await Promise.all([gzipAsync(data), brotliAsync(data)]);
      await Promise.all([writeFile(`${path}.gz`, gz), writeFile(`${path}.br`, br)]);
    }
  }
}
await compress(root);
console.log('Prepared gzip and Brotli assets for production hosting.');
