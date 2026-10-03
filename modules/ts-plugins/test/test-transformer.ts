import ts from 'typescript';
import type {PluginConfig} from 'ts-patch';

/**
 * Transpile ts code with TypeScript compiler API
 */
export function transpile({
  sourceFileName = 'test.ts',
  source,
  transformer,
  config = {},
  outputType = 'js'
}: {
  sourceFileName?: string;
  source: string;
  transformer: Function;
  config?: PluginConfig;
  outputType?: 'js' | 'd.ts';
}): string {
  const dts = outputType === 'd.ts';

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    declaration: dts,
    emitDeclarationOnly: dts,
    alwaysStrict: false
  };
  const sourceFile = ts.createSourceFile(
    sourceFileName,
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TS
  );
  const host = ts.createCompilerHost(compilerOptions);
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (requestedFileName, languageVersion, ...args) =>
    requestedFileName === sourceFileName
      ? sourceFile
      : getSourceFile(requestedFileName, languageVersion, ...args);
  host.fileExists = (requestedFileName) =>
    requestedFileName === sourceFileName || ts.sys.fileExists(requestedFileName);
  host.readFile = (requestedFileName) =>
    requestedFileName === sourceFileName ? source : ts.sys.readFile(requestedFileName);

  const program = ts.createProgram([sourceFileName], compilerOptions, host);

  const customTransformers: ts.CustomTransformers = {};
  const transform: ts.TransformerFactory<ts.SourceFile> = transformer(program, config, {ts});
  if (config.after) {
    customTransformers.after = [transform];
  } else if (config.afterDeclarations) {
    customTransformers.afterDeclarations = [transform];
  } else {
    customTransformers.before = [transform];
  }

  let output = '';
  program.emit(
    undefined,
    (outputFileName, text) => {
      if (outputFileName.endsWith(dts ? '.d.ts' : '.js')) {
        output = text;
      }
    },
    undefined,
    dts,
    customTransformers
  );
  return output;
}

/**
 * Compare two pieces of source code. Returns a description of the difference, or null if identical.
 */
export function assertSourceEqual(
  actual: string,
  expected: string,
  options: {
    /** If true, ignore difference in indent
     * @default true
     */
    ignoreIndent?: boolean;
    /** If true, ignore empty lines
     * @default true
     */
    ignoreEmptyLines?: boolean;
  } = {}
): true | string {
  const {ignoreIndent = true, ignoreEmptyLines = true} = options;
  const actualLines = actual.split('\n');
  const expectedLines = expected.split('\n');
  let i1 = 0;
  let i2 = 0;

  while (i1 < actualLines.length || i2 < expectedLines.length) {
    let t1 = actualLines[i1] ?? '';
    let t2 = expectedLines[i2] ?? '';
    if (ignoreIndent) {
      t1 = t1.trimStart();
      t2 = t2.trimStart();
    }
    if (t1 === t2) {
      i1++;
      i2++;
    } else if (ignoreEmptyLines && !t1) {
      i1++;
    } else if (ignoreEmptyLines && !t2) {
      i2++;
    } else {
      return `Mismatch at line ${i1}
    Actual: ${t1}
    Expected: ${t2}`;
    }
  }
  return true;
}
