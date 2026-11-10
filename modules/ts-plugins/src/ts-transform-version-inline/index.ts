/**
 * TypeScript transform to inject the current version of the package as string.
 * Usage with ts-patch:
   {
      "plugins": [
        {
          "transform": "ocular-dev-tools/ts-transform-version-inline",
          "identifier": "PACKAGE_VERSION"
        }
      ]
   }
 */
import {getPackageVersion} from '../transform-rules.js';
import type {Program, TransformationContext, SourceFile, Node} from 'typescript';
import type {TransformerExtras, PluginConfig} from 'ts-patch';

type VersionInlinePluginConfig = PluginConfig & {
  /** Identifier name to replace in code.
   * @default "__VERSION__"
   */
  identifier?: string;
};

export default function (
  program: Program,
  pluginConfig: VersionInlinePluginConfig,
  {ts}: TransformerExtras
) {
  const {identifier = '__VERSION__'} = pluginConfig;

  return (ctx: TransformationContext) => {
    const {factory} = ctx;

    return (sourceFile: SourceFile) => {
      let packageVersion: string | undefined;

      function visit(node: Node): Node {
        if (ts.isShorthandPropertyAssignment(node) && node.name.text === identifier) {
          const version = getPackageVersion(sourceFile.fileName);
          if (version)
            return factory.createPropertyAssignment(
              node.name,
              factory.createStringLiteral(version)
            );
        }
        if (
          ts.isIdentifier(node) &&
          !ts.isPropertyAccessExpression(node.parent) &&
          node.getText() === identifier
        ) {
          if (packageVersion === undefined) {
            packageVersion = getPackageVersion(sourceFile.fileName);
          }
          if (packageVersion) {
            if (ts.isShorthandPropertyAssignment(node.parent)) return node;
            return factory.createStringLiteral(packageVersion);
          }
        }
        return ts.visitEachChild(node, visit, ctx);
      }
      return ts.visitNode(sourceFile, visit);
    };
  };
}
