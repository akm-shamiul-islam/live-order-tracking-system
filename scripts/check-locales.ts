import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative } from 'node:path';
import { parseSync } from 'oxc-parser';
import { parseJson } from './lib/json.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
type Resources = Record<'ui' | 'food', Record<string, string>>;
const en = parseJson<Resources>(await readFile(join(root, 'frontend/src/locales/en.json'), 'utf8'));
const ja = parseJson<Resources>(await readFile(join(root, 'frontend/src/locales/ja.json'), 'utf8'));
const failures: string[] = [];
const tokens = (value: string) =>
  [...value.matchAll(/{{\s*([\w]+)\s*}}/g)]
    .map((match) => match[1])
    .sort()
    .join(',');
for (const namespace of ['ui', 'food'] as const) {
  for (const key of new Set([...Object.keys(en[namespace]), ...Object.keys(ja[namespace])])) {
    const english = en[namespace][key];
    const japanese = ja[namespace][key];
    if (!english || !japanese) failures.push(`${namespace}: missing translation for ${key}`);
    else if (tokens(english) !== tokens(japanese))
      failures.push(`${namespace}: interpolation mismatch for ${key}`);
    else if (
      english === japanese &&
      !['KitchenToDoor', 'kcal', 'admin@kitchentodoor.io'].includes(key)
    )
      failures.push(`${namespace}: untranslated Japanese copy for ${key}`);
  }
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
async function check(directory: string) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await check(path);
    else if (entry.name.endsWith('.tsx') && !/\.(?:spec|test)\.tsx$/.test(entry.name)) {
      const source = await readFile(path, 'utf8');
      const parsed = parseSync(path, source);
      if (parsed.errors.length) failures.push(`${relative(root, path)}: invalid TSX`);
      const bindings = new Map<string, unknown[]>();
      const collect = (value: unknown): void => {
        if (!object(value)) return;
        if (
          value.type === 'VariableDeclarator' &&
          object(value.id) &&
          typeof value.id.name === 'string'
        )
          bindings.set(value.id.name, [...(bindings.get(value.id.name) ?? []), value.init]);
        for (const child of Object.values(value)) {
          if (Array.isArray(child)) for (const node of child) collect(node);
          else if (object(child)) collect(child);
        }
      };
      collect(parsed.program);
      const copyCall = (value: unknown) =>
        object(value) &&
        value.type === 'CallExpression' &&
        object(value.callee) &&
        value.callee.name === 'c';
      const displayedCopy = (value: unknown, visited = new Set<string>()): void => {
        if (!object(value) || copyCall(value)) return;
        if (
          value.type === 'Literal' &&
          typeof value.value === 'string' &&
          /[A-Za-z]/.test(value.value)
        )
          failures.push(`${relative(root, path)}: unlocalized display string ${value.value}`);
        if (value.type === 'ConditionalExpression') {
          displayedCopy(value.consequent, visited);
          displayedCopy(value.alternate, visited);
        }
        if (value.type === 'LogicalExpression') displayedCopy(value.right, visited);
        if (
          value.type === 'Identifier' &&
          typeof value.name === 'string' &&
          !visited.has(value.name)
        ) {
          const initializers = bindings.get(value.name);
          if (initializers?.length === 1) {
            visited.add(value.name);
            displayedCopy(initializers[0], visited);
          }
        }
      };
      const visit = (value: unknown, parent?: Record<string, unknown>): void => {
        if (!object(value)) return;
        if (value.type === 'JSXExpressionContainer' && parent?.type !== 'JSXAttribute')
          displayedCopy(value.expression);
        if (
          value.type === 'JSXAttribute' &&
          object(value.name) &&
          ['aria-label', 'placeholder', 'title', 'alt', 'label'].includes(String(value.name.name))
        ) {
          if (object(value.value) && value.value.type === 'Literal') displayedCopy(value.value);
          else if (object(value.value)) displayedCopy(value.value.expression);
        }
        if (value.type === 'BinaryExpression' && (copyCall(value.left) || copyCall(value.right)))
          failures.push(
            `${relative(root, path)}: translate display labels instead of business comparisons`,
          );
        if (
          value.type === 'JSXAttribute' &&
          object(value.name) &&
          ['key', 'id', 'value'].includes(String(value.name.name)) &&
          object(value.value) &&
          copyCall(value.value.expression)
        )
          failures.push(
            `${relative(root, path)}: translated labels must not become identity or form values`,
          );
        if (
          value.type === 'JSXText' &&
          typeof value.value === 'string' &&
          /[A-Za-z]/.test(value.value)
        )
          failures.push(`${relative(root, path)}: unlocalized JSX text ${value.value.trim()}`);
        if (
          value.type === 'CallExpression' &&
          object(value.callee) &&
          value.callee.name === 'c' &&
          Array.isArray(value.arguments)
        ) {
          const args: unknown[] = value.arguments;
          const argument = args[0];
          if (
            object(argument) &&
            argument.type === 'Literal' &&
            typeof argument.value === 'string' &&
            !Object.hasOwn(en.ui, argument.value) &&
            !Object.hasOwn(en.food, argument.value)
          )
            failures.push(`${relative(root, path)}: missing copy key ${argument.value}`);
        }
        for (const child of Object.values(value)) {
          if (Array.isArray(child)) for (const node of child) visit(node, value);
          else if (object(child)) visit(child, value);
        }
      };
      visit(parsed.program);
    }
  }
}
await check(join(root, 'frontend/src'));
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `Locale checks passed: ${Object.keys(en.ui).length} UI keys, ${Object.keys(en.food).length} food names/descriptions, matching EN/JA interpolation and localized JSX.`,
  );
