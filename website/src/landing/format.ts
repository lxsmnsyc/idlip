/** Formats a byte count the way the site shows sizes: `962 B`, `3.9 kB`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) {
    return `${bytes} B`;
  }
  return `${(bytes / 1000).toFixed(1)} kB`;
}

/** Formats a whole number with thousands separators: `36,047`. */
export function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

/** Sums the gzip sizes of files. */
export function sumGzip(files: readonly { gzip: number }[]): number {
  let total = 0;
  for (const file of files) {
    total += file.gzip;
  }
  return total;
}
