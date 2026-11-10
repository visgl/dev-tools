import {createRequire} from 'node:module';
import path from 'node:path';
import ts from 'typescript';
import MagicString from 'magic-string';
import minimatch from 'minimatch';
import {
  getPackageVersion,
  appendExtension,
  filterShaderSource,
  resolveConstantTable,
  WEBGL_CONSTANT_MODULES
} from './transform-rules.js';

export type OutputPlugin = {
  transform?: string;
  identifier?: string;
  extensions?: string[];
  pattern?: string[];
  constantsModule?: string;
  pruneImports?: boolean;
  after?: boolean;
  afterDeclarations?: boolean;
};

/** Post-process native compiler output without patching or loading its compiler API. */
export function transformOutput(
  source: string,
  fileName: string,
  plugins: OutputPlugin[],
  constants: Record<string, number | string> = {},
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
  const version = versionPlugin && !declaration ? getPackageVersion(sourceFileName) : undefined;
  function rewrite(node: ts.Node | undefined) {
    if (!node || !ts.isStringLiteral(node) || !/^\.\.?\//.test(node.text)) return;
    let rewritten = node.text;
    for (const plugin of extensionPlugins) {
      rewritten = appendExtension(rewritten, plugin.extensions);
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
      const cleaned = filterShaderSource(text);
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
        !ts.isPropertyAccessExpression(node.parent) &&
        !(ts.isPropertyAssignment(node.parent) && node.parent.name === node) &&
        !(ts.isVariableDeclaration(node.parent) && node.parent.name === node)
      ) {
        output.overwrite(
          node.getStart(tree),
          node.end,
          ts.isShorthandPropertyAssignment(node.parent)
            ? `${node.text}: ${JSON.stringify(version)}`
            : JSON.stringify(version)
        );
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
          typeof constants[property.text] === 'number' &&
          Number.isFinite(constants[property.text])
        ) {
          const value = String(constants[property.text]);
          const replacement =
            ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node
              ? `(${value})`
              : value;
          output.overwrite(node.getStart(tree), node.end, replacement);
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
  if (
    !declaration &&
    inlineGL &&
    plugins.some(
      (plugin) =>
        plugin.transform?.endsWith('ts-transform-inline-webgl-constants') &&
        plugin.pruneImports !== false
    )
  ) {
    const modules = WEBGL_CONSTANT_MODULES;
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

/** Resolve only configured constants modules; no consuming repository layout assumptions. */
export function loadConstants(
  plugins: OutputPlugin[],
  configPath: string
): Record<string, number | string> {
  const plugin = plugins.find((plugin) =>
    plugin.transform?.endsWith('ts-transform-inline-webgl-constants')
  );
  if (!plugin) return {};
  return resolveConstantTable(
    plugin.constantsModule,
    configPath,
    () => createRequire(import.meta.url)('@luma.gl/constants').GL
  );
}
