import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const backendRoot = fileURLToPath(new URL('../', import.meta.url));
const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));
const receiptOutput = join(backendRoot, 'dist/receipts');
const fontOutput = resolve(receiptOutput, 'fonts');
const localeOutput = join(receiptOutput, 'locales');
const fontOutputRelative = relative(workspaceRoot, fontOutput);

if (
  isAbsolute(fontOutputRelative) ||
  fontOutputRelative === '..' ||
  fontOutputRelative.startsWith(`..${sep}`)
) {
  throw new Error('Receipt font output must remain inside the workspace.');
}

await mkdir(localeOutput, { recursive: true });
await rm(fontOutput, { recursive: true, force: true });
await cp(join(backendRoot, 'src/receipts/fonts'), fontOutput, { recursive: true });
for (const language of ['en', 'ja'] as const) {
  await cp(
    join(workspaceRoot, `frontend/src/locales/${language}.json`),
    join(localeOutput, `${language}.json`),
  );
}
