import { compile } from 'idlip/compiler';
import MarkdownIt from 'markdown-it';

/** A fenced `tsx` block of a page, and how the checker treats it. */
export interface Sample {
  /** The line of the opening fence, from 1. */
  line: number;
  /** The source to compile. A fragment is already wrapped in a component. */
  source: string;
}

export interface SampleProblem {
  file: string;
  line: number;
  message: string;
}

const parser = new MarkdownIt();

/**
 * The fence tags after the language: `no-check` skips a `tsx` block, `fragment` marks a view that
 * is only the expression after `return`.
 */
export function parseFence(info: string): { lang: string; flags: Set<string> } {
  const [lang = '', ...flags] = info.trim().split(/\s+/);
  return { lang, flags: new Set(flags) };
}

/** Wraps a view in a component, so a block can show only the markup. */
export function wrapFragment(source: string): string {
  return `import { For, Try, Head, Subscribe } from 'idlip';\nexport default function Sample() {\n  return (\n${source}\n  );\n}\n`;
}

/** The `tsx` blocks of a Markdown source that the checker compiles. */
export function extractSamples(markdown: string): Sample[] {
  const samples: Sample[] = [];
  for (const token of parser.parse(markdown, {})) {
    if (token.type !== 'fence') {
      continue;
    }
    const { lang, flags } = parseFence(token.info);
    if (lang !== 'tsx' || flags.has('no-check')) {
      continue;
    }
    samples.push({
      line: (token.map?.[0] ?? 0) + 1,
      source: flags.has('fragment') ? wrapFragment(token.content) : token.content,
    });
  }
  return samples;
}

/** Compiles every sample of a page and lists the diagnostics and thrown errors. */
export function checkMarkdown(markdown: string, file: string): SampleProblem[] {
  const problems: SampleProblem[] = [];
  for (const sample of extractSamples(markdown)) {
    try {
      const result = compile(sample.source, '/sample.tsx');
      for (const diagnostic of result.diagnostics) {
        problems.push({
          file,
          line: sample.line,
          message: `${diagnostic.severity} ${diagnostic.rule}: ${diagnostic.message}`,
        });
      }
    } catch (error) {
      problems.push({
        file,
        line: sample.line,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return problems;
}
