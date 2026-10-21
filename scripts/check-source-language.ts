import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  {
    cwd: root,
    encoding: 'utf8',
  },
).split('\0');
const javascript = files.filter(
  (file) => /\.(?:[cm]?js|jsx)$/i.test(file) && existsSync(resolve(root, file)),
);
if (javascript.length) {
  console.error(`Maintained source must use TypeScript:\n${javascript.join('\n')}`);
  process.exitCode = 1;
} else console.log('TypeScript source policy passed: no maintained JavaScript files.');
