// The code editor: a textarea over two layers, the highlighted code and the marks of the
// problems. The textarea keeps the caret, the selection, undo and the keyboard; the layers
// scroll with it.
import { escapeHtml, getLanguage, highlight } from './highlight.ts';

export interface Mark {
  start: number;
  end: number;
  severity: 'error' | 'warning';
  message: string;
}

export interface Editor {
  /** Shows a file. Keeps the undo history of the textarea only while the file stays. */
  show: (name: string, source: string) => void;
  /** Shows the problems of the file shown. */
  mark: (marks: readonly Mark[]) => void;
  /** Selects a range and scrolls it into view. */
  select: (start: number, end: number) => void;
}

/** The markup of the marks layer: the text is clear, only the marked ranges show. */
function renderMarks(source: string, marks: readonly Mark[]): string {
  let html = '';
  let at = 0;
  for (const mark of marks.toSorted((a, b) => a.start - b.start)) {
    const start = Math.max(mark.start, at);
    // An empty range marks the character after it, so it shows.
    const end = Math.min(source.length, Math.max(mark.end, start + 1));
    if (start >= source.length) {
      html += escapeHtml(source.slice(at));
      html += `<mark class="repl-mark is-${mark.severity} is-end"> </mark>`;
      at = source.length;
      continue;
    }
    html += escapeHtml(source.slice(at, start));
    html += `<mark class="repl-mark is-${mark.severity}">${escapeHtml(source.slice(start, end))}</mark>`;
    at = end;
  }
  return `${html}${escapeHtml(source.slice(at))}\n`;
}

export function createEditor(root: HTMLElement, onInput: (source: string) => void): Editor {
  const input = root.querySelector<HTMLTextAreaElement>('[data-repl-input]');
  const code = root.querySelector<HTMLElement>('[data-repl-highlight]');
  const marksLayer = root.querySelector<HTMLElement>('[data-repl-marks]');
  if (!input || !code || !marksLayer) {
    throw new Error('The REPL page has no editor');
  }
  const field = input;
  const layer = code;
  const marked = marksLayer;
  let name = '';
  let marks: readonly Mark[] = [];

  function paint(): void {
    // The trailing newline keeps the last empty line as tall as the textarea's.
    layer.innerHTML = `${highlight(field.value, getLanguage(name))}\n`;
    marked.innerHTML = renderMarks(field.value, marks);
  }

  function follow(): void {
    layer.style.translate = `${-field.scrollLeft}px ${-field.scrollTop}px`;
    marked.style.translate = layer.style.translate;
  }

  field.addEventListener('input', () => {
    // The marks belong to the text that was compiled, so they go until the next compile.
    marks = [];
    paint();
    onInput(field.value);
  });
  field.addEventListener('scroll', follow);

  // Tab indents by two spaces. Escape then Tab moves the focus on, so the keyboard never
  // gets stuck in the editor.
  let leave = false;
  field.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      leave = true;
      return;
    }
    if (event.key === 'Tab' && !leave && !event.shiftKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      // `insertText` keeps the change in the undo history, which no newer API does.
      // oxlint-disable-next-line typescript/no-deprecated
      document.execCommand('insertText', false, '  ');
    }
    leave = false;
  });

  return {
    show(next, source) {
      name = next;
      marks = [];
      if (field.value !== source) {
        field.value = source;
      }
      field.setAttribute('aria-label', `Code of ${next}`);
      paint();
      follow();
    },
    mark(next) {
      marks = next;
      paint();
    },
    select(start, end) {
      field.focus();
      field.setSelectionRange(start, end);
      // Scroll the line of the range into view: the textarea scrolls to the caret on focus.
      const line = field.value.slice(0, start).split('\n').length;
      const height = Number.parseFloat(getComputedStyle(field).lineHeight) || 20;
      field.scrollTop = Math.max(0, (line - 3) * height);
      follow();
    },
  };
}
