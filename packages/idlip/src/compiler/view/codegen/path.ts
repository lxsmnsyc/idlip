// oxlint-disable import/prefer-default-export
// The POSIX path steps the compiler needs, without `node:path`, so the compiler also runs in a
// browser. Each step returns what `node:path`'s `posix` returns for the same input.

/** `posix.dirname`: the path without its last segment. */
function getDirectory(path: string): string {
  if (path === '') {
    return '.';
  }
  const rooted = path.startsWith('/');
  // The last slash that follows a segment, skipping trailing slashes.
  let end = -1;
  let trailing = true;
  for (let index = path.length - 1; index >= 1; index--) {
    if (path[index] === '/') {
      if (!trailing) {
        end = index;
        break;
      }
    } else {
      trailing = false;
    }
  }
  if (end === -1) {
    return rooted ? '/' : '.';
  }
  if (rooted && end === 1) {
    return '//';
  }
  return path.slice(0, end);
}

/** `posix.normalize`: drops empty and `.` segments and resolves `..`. */
function normalizePath(path: string): string {
  const rooted = path.startsWith('/');
  const trailing = path.endsWith('/');
  const parts: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') {
      continue;
    }
    if (segment !== '..') {
      parts.push(segment);
    } else if (parts.length > 0 && parts.at(-1) !== '..') {
      parts.pop();
    } else if (!rooted) {
      parts.push('..');
    }
  }
  let result = parts.join('/');
  if (result === '') {
    if (rooted) {
      return '/';
    }
    return trailing ? './' : '.';
  }
  if (trailing) {
    result += '/';
  }
  return rooted ? `/${result}` : result;
}

/**
 * Resolves a relative specifier against the id of the module that imports it:
 * `posix.join(posix.dirname(importer), specifier)`. Other specifiers stay as they are.
 */
export function resolveSpecifier(specifier: string, importer: string): string {
  return specifier.startsWith('.')
    ? normalizePath(`${getDirectory(importer)}/${specifier}`)
    : specifier;
}
