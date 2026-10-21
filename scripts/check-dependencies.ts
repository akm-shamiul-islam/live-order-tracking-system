import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseJson, responseJson } from './lib/json.ts';

interface Manifest {
  engines?: { node?: string };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  version?: string;
}
interface Occurrence {
  file: string;
  section: 'dependencies' | 'devDependencies';
  specifier: string;
  installed: string | null;
}
interface RegistryPackage {
  version: string;
  deprecated?: string;
}
interface PackageResult {
  name: string;
  latest: string;
  target: string;
  policy: string | null;
  deprecated: string | null;
  current: boolean;
  occurrences: Occurrence[];
}

const root = fileURLToPath(new URL('../', import.meta.url));
const files = [
  'package.json',
  'backend/package.json',
  'frontend/package.json',
  'shared/package.json',
];
const packages = new Map<string, Occurrence[]>();
const rootManifest = parseJson<Manifest>(await readFile(resolve(root, 'package.json'), 'utf8'));
const nodeTypesMajor = /^(\d+)\.x$/.exec(rootManifest.engines?.node ?? '')?.[1];

for (const file of files) {
  const manifest = parseJson<Manifest>(await readFile(resolve(root, file), 'utf8'));
  for (const section of ['dependencies', 'devDependencies'] as const) {
    for (const [name, specifier] of Object.entries(manifest[section] ?? {})) {
      if (specifier.startsWith('workspace:')) continue;
      const paths = [
        resolve(root, dirname(file), 'node_modules', name, 'package.json'),
        resolve(root, 'node_modules', name, 'package.json'),
      ];
      const path = paths.find((candidate) => existsSync(candidate));
      const installed = path
        ? (parseJson<Manifest>(await readFile(path, 'utf8')).version ?? null)
        : null;
      const occurrences = packages.get(name) ?? [];
      occurrences.push({ file, section, specifier, installed });
      packages.set(name, occurrences);
    }
  }
}

const names = [...packages.keys()].sort((a, b) => a.localeCompare(b));
const results: PackageResult[] = [];
let next = 0;
await Promise.all(
  Array.from({ length: 6 }, async () => {
    while (next < names.length) {
      const name = names[next++];
      if (!name) continue;
      const response = await fetch(
        `https://registry.npmjs.org/${encodeURIComponent(name)}/latest`,
        { signal: AbortSignal.timeout(30_000) },
      );
      if (!response.ok) throw new Error(`npm lookup failed for ${name}: HTTP ${response.status}`);
      const metadata = await responseJson<RegistryPackage>(response);
      let target = metadata;
      let policy: string | null = null;
      if (name === '@types/node' && nodeTypesMajor) {
        const versionsResponse = await fetch(
          `https://registry.npmjs.org/${encodeURIComponent(name)}`,
          {
            headers: { Accept: 'application/vnd.npm.install-v1+json' },
            signal: AbortSignal.timeout(30_000),
          },
        );
        if (!versionsResponse.ok) {
          throw new Error(`npm version lookup failed for ${name}: HTTP ${versionsResponse.status}`);
        }
        const { versions } = await responseJson<{ versions: Record<string, RegistryPackage> }>(
          versionsResponse,
        );
        const compatible = Object.keys(versions)
          .filter(
            (version) =>
              version.startsWith(`${nodeTypesMajor}.`) && /^\d+\.\d+\.\d+$/.test(version),
          )
          .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
        const version = compatible.at(-1);
        if (!version) throw new Error(`No stable ${name} release matches Node ${nodeTypesMajor}`);
        const compatibleTarget = versions[version];
        if (!compatibleTarget) throw new Error(`Missing registry metadata for ${name}@${version}`);
        target = compatibleTarget;
        policy = `Match Node ${nodeTypesMajor} from the root engines.node setting`;
      }
      const occurrences = packages.get(name);
      if (!occurrences) throw new Error(`Missing manifest declarations for ${name}`);
      const current =
        !target.deprecated &&
        occurrences.every(
          ({ specifier, installed }) =>
            specifier.replace(/^[~^]/, '') === target.version && installed === target.version,
        );
      results.push({
        name,
        latest: metadata.version,
        target: target.version,
        policy,
        deprecated: target.deprecated ?? null,
        current,
        occurrences,
      });
    }
  }),
);
results.sort((a, b) => a.name.localeCompare(b.name));

const report = {
  checkedAt: new Date().toISOString(),
  registry: 'https://registry.npmjs.org',
  uniquePackages: results.length,
  declarations: results.reduce((count, result) => count + result.occurrences.length, 0),
  outdated: results.filter((result) => !result.current).length,
  packages: results,
};

if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
else {
  console.log(
    `Checked ${report.uniquePackages} packages across ${files.length} manifests against npm releases; ${report.outdated} need attention.`,
  );
  for (const result of results.filter((entry) => !entry.current)) {
    console.log(
      `${result.name}: target ${result.target}, npm latest ${result.latest}; ${result.occurrences.map((entry) => `${entry.file}: declared ${entry.specifier}, installed ${entry.installed ?? 'missing'}`).join('; ')}${result.deprecated ? `; deprecated: ${result.deprecated}` : ''}`,
    );
  }
  for (const result of results.filter((entry) => entry.target !== entry.latest)) {
    console.log(
      `${result.name}: compatible target ${result.target}; npm latest ${result.latest}. ${result.policy}.`,
    );
  }
}
if (report.outdated) process.exitCode = 1;
