// Parses a `--side` argument of the A/B scripts: `name=<path>` or `name=<path>:off`. The name ends
// at the first `=`, so a path may hold `=`. `:off` serves the build without preload links.
export function parseSide(entry) {
  const at = entry.indexOf('=');
  if (at <= 0 || at === entry.length - 1) {
    throw new Error(`A side is name=<path> or name=<path>:off, got ${JSON.stringify(entry)}`);
  }
  const spec = entry.slice(at + 1);
  const off = spec.endsWith(':off');
  return {
    name: entry.slice(0, at),
    path: off ? spec.slice(0, -':off'.length) : spec,
    preload: !off,
  };
}
