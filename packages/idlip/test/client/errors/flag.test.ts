import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compile } from '../../../src/compiler/index.ts';
import { getFeatures } from '../../../src/vite/features.ts';

const FIXTURES = join(import.meta.dirname, '../../fixtures');

describe('the errors flag', () => {
  it('is on for a module with a <Try>', () => {
    const source = readFileSync(join(FIXTURES, 'try/board.tsx'), 'utf8');
    expect(getFeatures([compile(source, '/src/board.tsx')])).toContain('ERRORS');
  });

  it('is off for a module without one', () => {
    const source = readFileSync(join(FIXTURES, 'todo/todo.tsx'), 'utf8');
    expect(getFeatures([compile(source, '/src/todo.tsx')])).not.toContain('ERRORS');
  });
});
