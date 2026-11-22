// Behavior shared by the three mocks: the theme toggle, the copy buttons and the live demo.
// The demo replays the requests that `website/docs/resuming.md` measures for `examples/todo`.

const CLICK_REQUESTS = [
  ['todo.handler.toggle.js', 119],
  ['todo.binding.todos._.done.js', 505],
];
const LOAD_TOTAL = 5885;

// Theme: the saved choice wins, then the system.
try {
  const saved = localStorage.getItem('theme');
  if (saved) {
    document.documentElement.dataset.theme = saved;
  }
} catch {}

function readTheme() {
  const set = document.documentElement.dataset.theme;
  if (set) {
    return set;
  }
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function formatBytes(bytes) {
  return `${bytes.toLocaleString('en-US')} B`;
}

function addRow(body, name, bytes) {
  const row = document.createElement('tr');
  row.className = 'net-new';
  const cell = document.createElement('td');
  cell.textContent = name;
  const size = document.createElement('td');
  size.textContent = formatBytes(bytes);
  row.append(cell, size);
  body.append(row);
  // The row enters from the state class, so a reset mid-way removes it without a jump.
  requestAnimationFrame(() => {
    row.classList.remove('net-new');
  });
}

function setUpDemo(demo) {
  const body = demo.querySelector('[data-net]');
  const total = demo.querySelector('[data-total]');
  const left = demo.querySelector('[data-left]');
  const note = demo.querySelector('[data-note]');
  const boxes = demo.querySelectorAll('input[type="checkbox"]');
  const initial = body.innerHTML;
  let loaded = false;
  let bytes = LOAD_TOTAL;

  function countLeft() {
    let count = 0;
    for (const box of boxes) {
      box.closest('li').classList.toggle('done', box.checked);
      if (!box.checked) {
        count++;
      }
    }
    left.textContent = String(count);
  }

  for (const box of boxes) {
    box.addEventListener('change', () => {
      countLeft();
      if (!loaded) {
        loaded = true;
        for (const [name, size] of CLICK_REQUESTS) {
          addRow(body, name, size);
          bytes += size;
        }
        note.textContent = 'First click: 2 requests, 624 B.';
      } else {
        note.textContent = 'Chunks are cached: 0 requests.';
      }
      total.textContent = formatBytes(bytes);
      demo.dataset.state = 'resumed';
    });
  }

  demo.querySelector('[data-reset]').addEventListener('click', () => {
    body.innerHTML = initial;
    for (const box of boxes) {
      box.checked = box.defaultChecked;
    }
    countLeft();
    loaded = false;
    bytes = LOAD_TOTAL;
    total.textContent = formatBytes(bytes);
    note.textContent = note.dataset.idle;
    demo.dataset.state = 'idle';
  });
}

for (const toggle of document.querySelectorAll('[data-theme-toggle]')) {
  toggle.addEventListener('click', () => {
    const next = readTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {}
  });
}

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const code = button.closest('.code-block').querySelector('pre').textContent;
    await navigator.clipboard?.writeText(code);
    button.textContent = 'Copied';
    setTimeout(() => {
      button.textContent = 'Copy';
    }, 1500);
  });
}

for (const demo of document.querySelectorAll('[data-demo]')) {
  setUpDemo(demo);
}
