/**
 * TypeScript transform that controls whether WebGPU-only code is emitted.
 */
/* eslint-disable complexity, max-depth */
import type {
  Expression,
  Identifier,
  Node,
  Program,
  SourceFile,
  Statement,
  TransformationContext,
  Transformer
} from 'typescript';
import type {PluginConfig, TransformerExtras} from 'ts-patch';

type WebGPUPluginConfig = PluginConfig & {
  /** Whether the emitted JavaScript includes WebGPU code paths. */
  webGPUEnabled?: boolean;
};

export default function transformWebGPU(
  program: Program,
  pluginConfig: WebGPUPluginConfig,
  {ts}: TransformerExtras
) {
  const webGPUEnabled = pluginConfig.webGPUEnabled ?? false;

  return (context: TransformationContext): Transformer<SourceFile> => {
    const {factory} = context;

    return (sourceFile) => {
      if (!webGPUEnabled && sourceFile.fileName.endsWith('.wgsl.ts')) {
        return replaceWGSLExports(sourceFile);
      }

      function isWebGPUDeviceCheck(node: Node): boolean {
        if (
          !ts.isBinaryExpression(node) ||
          node.operatorToken.kind !== ts.SyntaxKind.EqualsEqualsEqualsToken ||
          !ts.isStringLiteral(node.right) ||
          node.right.text !== 'webgpu' ||
          !ts.isPropertyAccessExpression(node.left) ||
          node.left.name.text !== 'type'
        ) {
          return false;
        }

        const device = node.left.expression;
        return (
          (ts.isIdentifier(device) && device.text === 'device') ||
          (ts.isPropertyAccessExpression(device) && device.name.text === 'device')
        );
      }

      function visit(node: Node): Node {
        if (!webGPUEnabled && ts.isVariableStatement(node)) {
          const declarations = node.declarationList.declarations;
          if (
            declarations.some(
              (declaration) =>
                declaration.initializer && isWGSLAnnotatedTemplate(declaration.initializer)
            )
          ) {
            const replacement = factory.createVariableStatement(
              node.modifiers,
              factory.createVariableDeclarationList(
                declarations.map((declaration) =>
                  factory.createVariableDeclaration(
                    declaration.name,
                    declaration.exclamationToken,
                    declaration.type,
                    declaration.initializer && isWGSLAnnotatedTemplate(declaration.initializer)
                      ? factory.createNull()
                      : (ts.visitNode(declaration.initializer, visit) as Expression | undefined)
                  )
                ),
                node.declarationList.flags
              )
            );
            ts.setTextRange(replacement, node);
            return replacement;
          }
        }
        if (!webGPUEnabled && isWGSLAnnotatedTemplate(node)) {
          const replacement = factory.createNull();
          ts.setEmitFlags(replacement, ts.EmitFlags.NoComments);
          return replacement;
        }
        if (ts.isConditionalExpression(node)) {
          const condition = ts.visitNode(node.condition, visit);
          if (condition.kind === ts.SyntaxKind.TrueKeyword) {
            return ts.visitNode(node.whenTrue, visit);
          }
          if (condition.kind === ts.SyntaxKind.FalseKeyword) {
            return ts.visitNode(node.whenFalse, visit);
          }
          return factory.updateConditionalExpression(
            node,
            condition as Expression,
            node.questionToken,
            ts.visitNode(node.whenTrue, visit) as Expression,
            node.colonToken,
            ts.visitNode(node.whenFalse, visit) as Expression
          );
        }
        if (ts.isIdentifier(node) && node.text === '__WEBGPU_ENABLED') {
          return webGPUEnabled ? factory.createTrue() : factory.createFalse();
        }
        if (!webGPUEnabled && isWebGPUDeviceCheck(node)) {
          return factory.createFalse();
        }
        return ts.visitEachChild(node, visit, context);
      }

      function isWGSLAnnotatedTemplate(node: Node): boolean {
        if (!ts.isNoSubstitutionTemplateLiteral(node) && !ts.isTemplateExpression(node)) {
          return false;
        }
        if (node.pos < 0) {
          return false;
        }

        const leadingTrivia = sourceFile.text.slice(node.getFullStart(), node.getStart(sourceFile));
        return /\/\*\s*wgsl\s*\*\/\s*$/i.test(leadingTrivia);
      }

      const transformedSourceFile = ts.visitEachChild(sourceFile, visit, context);
      return foldBooleanConstants(transformedSourceFile);

      function foldBooleanConstants(file: SourceFile): SourceFile {
        const booleanConstants = new Map<object, boolean>();

        function collect(node: Node): void {
          if (ts.isVariableStatement(node) && node.declarationList.flags & ts.NodeFlags.Const) {
            for (const declaration of node.declarationList.declarations) {
              if (
                ts.isIdentifier(declaration.name) &&
                declaration.initializer &&
                (declaration.initializer.kind === ts.SyntaxKind.TrueKeyword ||
                  declaration.initializer.kind === ts.SyntaxKind.FalseKeyword)
              ) {
                const symbol = program.getTypeChecker().getSymbolAtLocation(declaration.name);
                if (symbol) {
                  booleanConstants.set(
                    symbol,
                    declaration.initializer.kind === ts.SyntaxKind.TrueKeyword
                  );
                }
              }
            }
          }
          ts.forEachChild(node, collect);
        }

        // Resolve symbols from the original tree. Nodes synthesized by an earlier
        // transform pass are not always connected to the program's type checker.
        collect(sourceFile);

        function fold(node: Node): Node {
          if (ts.isConditionalExpression(node)) {
            const condition = ts.visitNode(node.condition, fold);
            const constantValue = getBooleanConstant(condition);
            if (constantValue === true) {
              return ts.visitNode(node.whenTrue, fold);
            }
            if (constantValue === false) {
              return ts.visitNode(node.whenFalse, fold);
            }
            return factory.updateConditionalExpression(
              node,
              condition as Expression,
              node.questionToken,
              ts.visitNode(node.whenTrue, fold) as Expression,
              node.colonToken,
              ts.visitNode(node.whenFalse, fold) as Expression
            );
          }
          return ts.visitEachChild(node, fold, context);
        }

        function getBooleanConstant(node: Node): boolean | undefined {
          if (node.kind === ts.SyntaxKind.TrueKeyword) {
            return true;
          }
          if (node.kind === ts.SyntaxKind.FalseKeyword) {
            return false;
          }
          if (ts.isIdentifier(node)) {
            const symbol = program.getTypeChecker().getSymbolAtLocation(node);
            return symbol && booleanConstants.get(symbol);
          }
          return undefined;
        }

        return ts.visitEachChild(file, fold, context);
      }

      function replaceWGSLExports(wgslSourceFile: SourceFile): SourceFile {
        const statements: Statement[] = [];

        for (const statement of wgslSourceFile.statements) {
          if (ts.isExportAssignment(statement)) {
            statements.push(
              factory.updateExportAssignment(statement, statement.modifiers, factory.createNull())
            );
          } else if (ts.isFunctionDeclaration(statement) && hasExportModifier(statement)) {
            const stub = createNullFunction();
            if (hasDefaultModifier(statement)) {
              statements.push(factory.createExportAssignment(undefined, false, stub));
            } else if (statement.name) {
              statements.push(createExportedConstant(statement.name, stub));
            }
          } else if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
            for (const declaration of statement.declarationList.declarations) {
              if (ts.isIdentifier(declaration.name)) {
                statements.push(createExportedConstant(declaration.name, factory.createNull()));
              }
            }
          } else if (
            (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
            hasExportModifier(statement)
          ) {
            statements.push(statement);
          }
        }

        return factory.updateSourceFile(wgslSourceFile, statements);
      }

      function createExportedConstant(name: Identifier, initializer: Expression) {
        return factory.createVariableStatement(
          [factory.createModifier(ts.SyntaxKind.ExportKeyword)],
          factory.createVariableDeclarationList(
            [factory.createVariableDeclaration(name, undefined, undefined, initializer)],
            ts.NodeFlags.Const
          )
        );
      }

      function createNullFunction() {
        return factory.createArrowFunction(
          undefined,
          undefined,
          [],
          undefined,
          factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
          factory.createNull()
        );
      }

      function hasExportModifier(node: Node): boolean {
        return ts.canHaveModifiers(node)
          ? Boolean(
              ts
                .getModifiers(node)
                ?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
            )
          : false;
      }

      function hasDefaultModifier(node: Node): boolean {
        return ts.canHaveModifiers(node)
          ? Boolean(
              ts
                .getModifiers(node)
                ?.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)
            )
          : false;
      }
    };
  };
}
