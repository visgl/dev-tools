import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import MagicString from 'magic-string';
import remapping from '@ampproject/remapping';
import minimatch from 'minimatch';

type Plugin = {
  transform?: string;
  identifier?: string;
  extensions?: string[];
  pattern?: string[];
  constantsModule?: string;
  after?: boolean;
  afterDeclarations?: boolean;
};

/** Post-process native compiler output without patching or loading its compiler API. */
export function transformOutput(
  source: string,
  fileName: string,
  plugins: Plugin[],
  constants: Record<string, number> = {},
  sourceFileName = fileName
) {
  const tree = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const output = new MagicString(source);
  const declaration = /\.d\.[cm]?ts$/.test(fileName);
  const names = plugins.map((plugin) => plugin.transform?.split('/').pop());
  const extensionPlugins = plugins.filter(
    (plugin, index) =>
      names[index] === 'ts-transform-append-extension' &&
      Boolean(plugin.afterDeclarations) === declaration
  );
  const versionPlugin = plugins.find(
    (_plugin, index) => names[index] === 'ts-transform-version-inline'
  );
  const glslPlugin = plugins.find(
    (_plugin, index) => names[index] === 'ts-transform-remove-glsl-comments'
  );
  const glsl = Boolean(glslPlugin);
  const shaderFile = glslPlugin?.pattern?.some((pattern) =>
    minimatch(path.relative(process.cwd(), sourceFileName), pattern)
  );
  const inlineGL = names.includes('ts-transform-inline-webgl-constants');
  const imports: ts.ImportDeclaration[] = [];
  const runtimeIdentifiers = new Set<string>();
  let version: string | undefined;
  if (versionPlugin && !declaration) {
    let directory = path.dirname(sourceFileName);
    while (true) {
      const manifest = path.join(directory, 'package.json');
      if (fs.existsSync(manifest)) {
        version = JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
        break;
      }
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }
  function rewrite(node: ts.Node | undefined) {
    if (!node || !ts.isStringLiteral(node) || !/^\.\.?\//.test(node.text)) return;
    let rewritten = node.text;
    for (const plugin of extensionPlugins) {
      const mappings = new Map<string, string>();
      for (const extension of plugin.extensions ?? ['.js']) {
        const addition = path.extname(extension) || extension;
        mappings.set(path.basename(extension, addition), addition);
      }
      rewritten += mappings.get(path.extname(rewritten)) ?? '';
    }
    if (rewritten !== node.text) output.appendLeft(node.end - 1, rewritten.slice(node.text.length));
  }

  function shader(node: ts.Node) {
    if (ts.isTemplateSpan(node)) {
      visit(node.expression);
      shader(node.literal);
      return;
    }
    if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateLiteralToken(node)) {
      // Edit only literal contents, leaving interpolation delimiters and escapes intact.
      const start = node.getStart(tree) + 1;
      const end = node.end - (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) ? 2 : 1);
      const text = source.slice(start, end);
      const cleaned = text
        .replace(/\s*\/\/.*[\n\r]/g, '\n')
        .replace(/\s*\/\*(\*(?!\/)|[^*])*\*\//g, '')
        .replace(/\s*[\n\r]\s*/gm, '\n');
      if (cleaned !== text) output.overwrite(start, end, cleaned);
    } else ts.forEachChild(node, shader);
  }
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      rewrite(node.moduleSpecifier);
      imports.push(node);
      return;
    }
    if (ts.isExportDeclaration(node)) rewrite(node.moduleSpecifier);
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
      rewrite(node.argument.literal);
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)
      rewrite(node.arguments[0]);
    if (!declaration) {
      if (
        version &&
        ts.isIdentifier(node) &&
        node.text === (versionPlugin?.identifier ?? '__VERSION__') &&
        !ts.isPropertyAccessExpression(node.parent)
      ) {
        output.overwrite(node.getStart(tree), node.end, JSON.stringify(version));
        return;
      }
      if (
        inlineGL &&
        (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
        ts.isIdentifier(node.expression) &&
        ['GL', 'gl'].includes(node.expression.text)
      ) {
        const property = ts.isPropertyAccessExpression(node) ? node.name : node.argumentExpression;
        if (
          property &&
          ((ts.isIdentifier(property) && ts.isPropertyAccessExpression(node)) ||
            ts.isStringLiteral(property)) &&
          Object.hasOwn(constants, property.text)
        ) {
          output.overwrite(node.getStart(tree), node.end, String(constants[property.text]));
          return;
        }
      }
      if (glsl && ts.isTaggedTemplateExpression(node) && node.tag.getText(tree) === 'glsl') {
        output.remove(node.getStart(tree), node.template.getStart(tree));
        shader(node.template);
        return;
      }
    }
    if (!declaration && shaderFile && ts.isTemplateLiteral(node)) {
      shader(node);
      return;
    }
    if (ts.isIdentifier(node)) runtimeIdentifiers.add(node.text);
    ts.forEachChild(node, visit);
  }
  visit(tree);
  // The shared constants plugin prunes imports made unused by inlining. The
  // repository-local luma.gl plugin intentionally leaves its imports intact.
  if (
    !declaration &&
    plugins.some(
      (plugin) => plugin.transform === '@vis.gl/ts-plugins/ts-transform-inline-webgl-constants'
    )
  ) {
    const modules = new Set([
      '@luma.gl/constants',
      '@luma.gl/webgl/constants',
      'luma.gl/constants'
    ]);
    for (const statement of imports) {
      if (
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        !modules.has(statement.moduleSpecifier.text)
      )
        continue;
      const clause = statement.importClause;
      const bindings = clause?.namedBindings;
      if (!clause || !bindings || !ts.isNamedImports(bindings)) continue;
      const kept = bindings.elements.filter((element) => runtimeIdentifiers.has(element.name.text));
      if (kept.length === bindings.elements.length) continue;
      if (!kept.length && !clause.name) output.remove(statement.getStart(tree), statement.end);
      else if (!kept.length && clause.name) output.remove(clause.name.end, bindings.end);
      else
        output.overwrite(
          bindings.getStart(tree),
          bindings.end,
          '{' + kept.map((element) => element.getText(tree)).join(', ') + '}'
        );
    }
  }
  return {
    code: output.toString(),
    map: output.generateMap({hires: true, source: path.basename(fileName), includeContent: true})
  };
}

export async function nativeBuild(project: string) {
  const configPath = path.resolve(project);
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error)
    throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
  const plugins = (parsed.options.plugins ?? []) as Plugin[];
  const supported = new Set([
    'ts-transform-version-inline',
    'ts-transform-inline-webgl-constants',
    'ts-transform-remove-glsl-comments',
    'ts-transform-append-extension'
  ]);
  for (const plugin of plugins) {
    if (plugin.transform && !supported.has(plugin.transform.split('/').pop()!))
      throw new Error(`Native build does not support transformer ${plugin.transform}`);
  }
  const require = createRequire(path.join(process.cwd(), 'package.json'));
  let constants: Record<string, number> = {};
  const glPlugin = plugins.find((plugin) =>
    plugin.transform?.endsWith('ts-transform-inline-webgl-constants')
  );
  if (glPlugin) {
    // luma.gl bootstraps this constants-only export before compiling core.
    const localConstants = path.resolve('../../modules/core/dist/webgl-constants/index.cjs');
    constants = glPlugin.constantsModule
      ? require(
          glPlugin.constantsModule.startsWith('.')
            ? path.resolve(path.dirname(configPath), glPlugin.constantsModule)
            : glPlugin.constantsModule
        ).GL
      : glPlugin.transform === '@luma.gl/ts-transform-inline-webgl-constants' &&
          fs.existsSync(localConstants)
        ? require(localConstants).GL
        : createRequire(require.resolve(glPlugin.transform!))('@luma.gl/constants').GL;
  }
  const manifestPath = require.resolve('typescript/package.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (Number(manifest.version.split('.')[0]) < 7)
    throw new Error('Native builds require TypeScript >= 7 in the consuming project');
  const executable = path.resolve(path.dirname(manifestPath), manifest.bin.tsc);
  // Re-emit all files: incremental builds must not leave a mixture of transformed and raw output.
  const result = spawnSync(
    process.execPath,
    [
      executable,
      '--project',
      configPath,
      '--declaration',
      '--declarationMap',
      '--sourceMap',
      '--outDir',
      'dist',
      '--incremental',
      'false',
      '--composite',
      'false'
    ],
    {stdio: 'inherit'}
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`TypeScript exited with status ${result.status}`);
  for (const fileName of walk(path.resolve('dist'))) {
    if (!/\.(?:[cm]?js|d\.[cm]?ts)$/.test(fileName)) continue;
    const original = fs.readFileSync(fileName, 'utf8');
    const mapPath = `${fileName}.map`;
    const previous = fs.existsSync(mapPath)
      ? JSON.parse(fs.readFileSync(mapPath, 'utf8'))
      : undefined;
    const sourceFileName = previous?.sources?.[0]
      ? path.resolve(path.dirname(mapPath), previous.sourceRoot ?? '', previous.sources[0])
      : fileName;
    const transformed = transformOutput(original, fileName, plugins, constants, sourceFileName);
    if (transformed.code === original) continue;
    if (previous) {
      const combined = remapping([JSON.parse(transformed.map.toString()), previous], () => null);
      combined.file = path.basename(fileName);
      fs.writeFileSync(mapPath, JSON.stringify(combined));
    }
    fs.writeFileSync(fileName, transformed.code);
  }
}

function* walk(directory: string): Generator<string> {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const fileName = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(fileName);
    else yield fileName;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await nativeBuild(process.argv[2] || 'tsconfig.json');
}
