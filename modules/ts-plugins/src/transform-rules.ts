import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

export function getPackageVersion(fileName: string): string | undefined {
  let directory = path.dirname(fileName);
  while (true) {
    const manifest = path.join(directory, 'package.json');
    if (fs.existsSync(manifest)) return JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

export function appendExtension(specifier: string, extensions = ['.js']): string {
  if (!/^\.\.?\//.test(specifier)) return specifier;
  const mappings = new Map<string, string>();
  for (const extension of extensions) {
    const addition = path.extname(extension) || extension;
    mappings.set(path.basename(extension, addition), addition);
  }
  return specifier + (mappings.get(path.extname(specifier)) ?? '');
}

export function filterShaderSource(source: string): string {
  return source
    .replace(/\s*\/\/.*[\n\r]/g, '\n')
    .replace(/\s*\/\*(\*(?!\/)|[^*])*\*\//g, '')
    .replace(/\s*[\n\r]\s*/gm, '\n');
}

export const WEBGL_CONSTANT_MODULES = new Set([
  '@luma.gl/constants',
  '@luma.gl/webgl/constants',
  'luma.gl/constants'
]);

/** A consumer supplies its own constants module explicitly, relative to its config. */
export function resolveConstantTable(
  request: string | undefined,
  configPath: string,
  fallback: () => Record<string, number | string>
): Record<string, number | string> {
  const table = request
    ? createRequire(configPath)(
        request.startsWith('.') ? path.resolve(path.dirname(configPath), request) : request
      ).GL
    : fallback();
  if (!table || typeof table !== 'object')
    throw new Error('Constants module must export a GL table');
  return table;
}
