import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { MENU_ITEMS } from '@kitchentodoor/shared';

const backendRoot = fileURLToPath(new URL('../', import.meta.url));
const workspaceRoot = fileURLToPath(new URL('../../', import.meta.url));
const receiptOutput = join(backendRoot, 'dist/receipts');
const fontOutput = resolve(receiptOutput, 'fonts');
const localeOutput = join(receiptOutput, 'locales');
const imageOutput = join(receiptOutput, 'images');
for (const output of [fontOutput, resolve(imageOutput)]) {
  const outputRelative = relative(workspaceRoot, output);
  if (
    isAbsolute(outputRelative) ||
    outputRelative === '..' ||
    outputRelative.startsWith(`..${sep}`)
  )
    throw new Error('Receipt asset output must remain inside the workspace.');
}

await mkdir(localeOutput, { recursive: true });
await rm(fontOutput, { recursive: true, force: true });
await rm(imageOutput, { recursive: true, force: true });
await cp(join(backendRoot, 'src/receipts/fonts'), fontOutput, { recursive: true });
await mkdir(imageOutput, { recursive: true });
await Promise.all(
  [...new Set(MENU_ITEMS.map(({ photo }) => photo))].map((photo) =>
    sharp(join(workspaceRoot, `frontend/public/menu/${photo}-480.webp`))
      .resize(96, 96, { fit: 'cover' })
      .jpeg({ quality: 82 })
      .toFile(join(imageOutput, `${photo}.jpg`)),
  ),
);
for (const language of ['en', 'ja'] as const) {
  await cp(
    join(workspaceRoot, `frontend/src/locales/${language}.json`),
    join(localeOutput, `${language}.json`),
  );
}
