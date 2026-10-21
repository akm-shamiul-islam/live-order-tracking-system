// JSON and browser evaluation are serialization boundaries; callers supply the
// expected contract and workflow assertions verify the returned application data.
export function parseJson<T = unknown>(text: string): T {
  const value: unknown = JSON.parse(text);
  return value as T;
}

export async function responseJson<T = unknown>(response: Response): Promise<T> {
  const value: unknown = await response.json();
  return value as T;
}

export function packageVersion(require: NodeJS.Require, name: string): string {
  const metadata: unknown = require(`${name}/package.json`);
  if (
    metadata &&
    typeof metadata === 'object' &&
    'version' in metadata &&
    typeof metadata.version === 'string'
  )
    return metadata.version;
  throw new Error(`Missing package version for ${name}`);
}
