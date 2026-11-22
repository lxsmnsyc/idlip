// Compiles the files of a REPL session. The REPL worker runs it, and the tests run it in Node.
import { compile, listChildren } from 'idlip/compiler';
import { resolveName } from './chunks.ts';
import { PROPS_FILE, isModuleName } from './files.ts';
import type { ReplFile } from './files.ts';

type CompileResult = ReturnType<typeof compile>;

/** The folder of the module ids, as an app's `src/` is in Vite. */
const ROOT = '/src/';

export interface Problem {
  file: string;
  severity: 'error' | 'warning';
  rule: string;
  message: string;
  /** Offsets in the file source. */
  start: number;
  end: number;
  /** From 1. */
  line: number;
  column: number;
}

export interface CompiledFile {
  name: string;
  /** The module id given to the compiler: `/src/<name>`. */
  id: string;
  /** True when another file renders it as a child. */
  child: boolean;
  result: CompileResult;
}

export interface Project {
  files: CompiledFile[];
  problems: Problem[];
  props: Record<string, unknown>;
  /** True when no problem is an error, so the project can run. */
  ok: boolean;
}

function getPosition(source: string, offset: number): { line: number; column: number } {
  const before = source.slice(0, offset);
  return { line: before.split('\n').length, column: offset - before.lastIndexOf('\n') };
}

function createProblem(
  file: ReplFile,
  severity: Problem['severity'],
  rule: string,
  message: string,
  span: { start: number; end: number } = { start: 0, end: 0 },
): Problem {
  return {
    file: file.name,
    severity,
    rule,
    message,
    ...span,
    ...getPosition(file.source, span.start),
  };
}

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function readProps(file: ReplFile | undefined, problems: Problem[]): Record<string, unknown> {
  if (file === undefined) {
    return {};
  }
  let value: unknown;
  try {
    value = JSON.parse(file.source);
  } catch (error) {
    problems.push(createProblem(file, 'error', 'props-json', getMessage(error)));
    return {};
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    problems.push(createProblem(file, 'error', 'props-json', 'The props must be a JSON object'));
    return {};
  }
  return { ...value };
}

/** Lists the files each module renders as a child, and reports a child that is not a file. */
function findChildren(modules: readonly ReplFile[], problems: Problem[]): Set<string> {
  const names = new Set<string>();
  for (const file of modules) {
    names.add(file.name);
  }
  const children = new Set<string>();
  for (const file of modules) {
    let specifiers: string[] = [];
    try {
      specifiers = listChildren(file.source, `${ROOT}${file.name}`);
    } catch {
      // The compile below reports the error.
    }
    for (const specifier of specifiers) {
      const name = resolveName(specifier);
      if (name !== undefined && names.has(name)) {
        children.add(name);
        continue;
      }
      const start = Math.max(0, file.source.indexOf(specifier));
      problems.push(
        createProblem(
          file,
          'error',
          'repl-import',
          `${specifier} is not a file of this REPL. Add it as a file next to this one.`,
          { start, end: start + specifier.length },
        ),
      );
    }
  }
  return children;
}

/** Compiles every file. A problem of any file stops the run, not the other files' output. */
export function compileProject(files: readonly ReplFile[]): Project {
  const problems: Problem[] = [];
  const modules: ReplFile[] = [];
  let propsFile: ReplFile | undefined;
  for (const file of files) {
    if (isModuleName(file.name)) {
      modules.push(file);
    } else if (file.name === PROPS_FILE) {
      propsFile = file;
    } else {
      problems.push(
        createProblem(
          file,
          'error',
          'repl-file',
          `The REPL runs *.tsx files and ${PROPS_FILE}. Rename ${file.name}.`,
        ),
      );
    }
  }
  if (modules.length === 0 || modules[0] !== files[0]) {
    problems.push({
      file: files[0]?.name ?? '',
      severity: 'error',
      rule: 'repl-entry',
      message: 'The first file is the page, so it must be a *.tsx file.',
      start: 0,
      end: 0,
      line: 1,
      column: 1,
    });
  }
  const props = readProps(propsFile, problems);
  const children = findChildren(modules, problems);

  const compiled: CompiledFile[] = [];
  for (const file of modules) {
    const id = `${ROOT}${file.name}`;
    const child = children.has(file.name);
    let result: CompileResult;
    try {
      result = compile(file.source, id, { child });
    } catch (error) {
      problems.push(createProblem(file, 'error', 'compile', getMessage(error)));
      continue;
    }
    for (const diagnostic of result.diagnostics) {
      problems.push(
        createProblem(
          file,
          diagnostic.severity,
          diagnostic.rule,
          diagnostic.message,
          diagnostic.span,
        ),
      );
    }
    compiled.push({ name: file.name, id, child, result });
  }
  let ok = true;
  for (const problem of problems) {
    if (problem.severity === 'error') {
      ok = false;
    }
  }
  return { files: compiled, problems, props, ok };
}
