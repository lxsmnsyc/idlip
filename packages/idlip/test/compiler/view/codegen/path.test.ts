import { posix } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { resolveSpecifier } from '../../../../src/compiler/view/codegen/path.ts';

// Paths built from the segments that change the result: empty, `.`, `..`, dot names and names.
const segment = fc.constantFrom('', '.', '..', '.h', 'src', 'a.idlip.tsx', 'b');
const path = fc
  .tuple(fc.boolean(), fc.array(segment, { maxLength: 6 }), fc.boolean())
  .map(([rooted, parts, trailing]) => {
    const joined = `${rooted ? '/' : ''}${parts.join('/')}`;
    return trailing && joined !== '' ? `${joined}/` : joined;
  });
// Every specifier the function resolves starts with `.`: `.`, `..`, `.h`, `./x`, `../x`, `.h/x`.
const specifier = fc
  .tuple(fc.constantFrom('.', '..', '.h'), fc.option(path, { nil: undefined }))
  .map(([head, rest]) => (rest === undefined ? head : `${head}/${rest.replace(/^\/+/, '')}`));

describe('resolveSpecifier', () => {
  it('matches posix.join of the importer directory', () => {
    fc.assert(
      fc.property(specifier, path, (relative, importer) => {
        expect(resolveSpecifier(relative, importer)).toBe(
          posix.join(posix.dirname(importer), relative),
        );
      }),
      { numRuns: 5000 },
    );
  });

  it('resolves a sibling and a parent file', () => {
    expect(resolveSpecifier('./counter.idlip.tsx', '/src/board.idlip.tsx')).toBe(
      '/src/counter.idlip.tsx',
    );
    expect(resolveSpecifier('../a.idlip.tsx', '/src/b/c.idlip.tsx')).toBe('/src/a.idlip.tsx');
  });

  it('keeps a bare specifier', () => {
    expect(resolveSpecifier('idlip', '/src/a.idlip.tsx')).toBe('idlip');
  });
});
