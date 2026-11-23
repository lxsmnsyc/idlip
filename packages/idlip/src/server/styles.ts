/**
 * The key of a module's stylesheets in its chunk map: the URLs of every stylesheet its import
 * graph reaches, separated by a space. The plugin writes it, `render()` drops it from the state
 * script and returns the union as `RenderResult.styles`.
 */
export const STYLES_KEY = 'styles';

function escapeAttr(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/** Splits the value of a `styles` key into URLs. A URL holds no space, so the plugin encodes it. */
export function readStyles(value: string | undefined): string[] {
  return value === undefined || value === '' ? [] : value.split(' ');
}

/** Returns the `<link rel="stylesheet">` tags of the given URLs, with the nonce when there is one. */
export function renderStyles(urls: readonly string[], nonce?: string): string {
  const attr = nonce === undefined ? '' : ` nonce="${escapeAttr(nonce)}"`;
  let out = '';
  for (const url of urls) {
    out += `<link rel="stylesheet" href="${escapeAttr(url)}"${attr}>`;
  }
  return out;
}
