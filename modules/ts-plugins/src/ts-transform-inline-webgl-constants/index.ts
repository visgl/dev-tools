/**
 * TypeScript transform to replaces `gl.<constant>` or `GL.<constant>` references with 
 * the corresponding WebGL constant value. Requires `@luma.gl/constants` as peer dependency.
 * Usage with ts-patch:
   {
      "plugins": [
        {
          "transform": "ocular-dev-tools/ts-transform-inline-webgl-constants"
        }
      ]
   }
 */
import type {Program, TransformationContext, SourceFile, Node} from 'typescript';
import type {TransformerExtras, PluginConfig} from 'ts-patch';
import {GL} from '@luma.gl/constants';

const WEBGL_CONSTANT_MODULES = new Set([
  '@luma.gl/constants',
  '@luma.gl/webgl/constants',
  'luma.gl/constants'
]);

export default function (program: Program, pluginConfig: PluginConfig, {ts}: TransformerExtras) {
  return (ctx: TransformationContext) => {
    const {factory} = ctx;

    function filterLeftIdentifier(node: Node): boolean {
      const left = node.getChildAt(0);
      return ts.isIdentifier(left) && (left.text === 'GL' || left.text === 'gl');
    }

    return (sourceFile: SourceFile) => {
      function visit(node: Node): Node {
        if (ts.isImportDeclaration(node)) {
          return node;
        }
        if (ts.isPropertyAccessExpression(node) && filterLeftIdentifier(node)) {
          const key = node.getChildAt(2);
          if (ts.isIdentifier(key) && key.text in GL) {
            return factory.createNumericLiteral(GL[key.text]);
          }
        }
        if (ts.isElementAccessExpression(node) && filterLeftIdentifier(node)) {
          const key = node.getChildAt(2);
          if (ts.isStringLiteral(key) && key.text in GL) {
            return factory.createNumericLiteral(GL[key.text]);
          }
        }
        return ts.visitEachChild(node, visit, ctx);
      }

      const transformedSourceFile = ts.visitEachChild(sourceFile, visit, ctx);
      const runtimeIdentifiers = getRuntimeIdentifiers(transformedSourceFile);

      const statements = transformedSourceFile.statements.flatMap((statement) => {
        if (!ts.isImportDeclaration(statement) || !isWebGLConstantsImport(statement)) {
          return [statement];
        }

        const importClause = statement.importClause;
        const namedBindings = importClause?.namedBindings;
        if (!importClause || !namedBindings || !ts.isNamedImports(namedBindings)) {
          return [statement];
        }

        const elements = namedBindings.elements.filter((element) =>
          runtimeIdentifiers.has(element.name.text)
        );
        if (elements.length === namedBindings.elements.length) {
          return [statement];
        }
        if (!elements.length && !importClause.name) {
          return [];
        }

        const updatedNamedBindings = elements.length
          ? factory.updateNamedImports(namedBindings, elements)
          : undefined;
        const updatedImportClause = factory.updateImportClause(
          importClause,
          importClause.isTypeOnly,
          importClause.name,
          updatedNamedBindings
        );
        return [
          factory.updateImportDeclaration(
            statement,
            statement.modifiers,
            updatedImportClause,
            statement.moduleSpecifier,
            statement.assertClause
          )
        ];
      });

      return factory.updateSourceFile(transformedSourceFile, statements);

      function getRuntimeIdentifiers(node: Node): Set<string> {
        const identifiers = new Set<string>();

        collectRuntimeIdentifiers(node);
        return identifiers;

        function collectRuntimeIdentifiers(child: Node): void {
          if (ts.isImportDeclaration(child) || ts.isTypeNode(child)) {
            return;
          }
          if (ts.isIdentifier(child)) {
            identifiers.add(child.text);
          }
          ts.forEachChild(child, collectRuntimeIdentifiers);
        }
      }

      function isWebGLConstantsImport(node: Node): boolean {
        if (ts.isImportDeclaration(node)) {
          return (
            ts.isStringLiteral(node.moduleSpecifier) &&
            WEBGL_CONSTANT_MODULES.has(node.moduleSpecifier.text)
          );
        }
        return false;
      }
    };
  };
}
