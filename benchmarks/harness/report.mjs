// Formats a result as a markdown report with one column per framework.
function num(value) {
  return Math.round(value).toLocaleString('en-US');
}
function kb(bytes) {
  return bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} kB` : `${bytes} B`;
}
function size(raw, gzip) {
  return `${kb(raw)} / ${kb(gzip)}`;
}
function js(entry) {
  return entry ? `${entry.jsFiles} · ${size(entry.jsRaw, entry.jsGzip)}` : '–';
}
function ms(value) {
  return typeof value === 'number' ? `${value} ms` : value;
}

function table(names, labels, rows) {
  const heads = [];
  let aligns = '';
  for (const name of names) {
    heads.push(labels[name]);
    aligns += ' ---: |';
  }
  const lines = [`| Metric | ${heads.join(' | ')} |`, `| --- |${aligns}`];
  for (const [label, cell] of rows) {
    const values = [];
    for (const name of names) {
      values.push(cell(name) ?? '–');
    }
    lines.push(`| ${label} | ${values.join(' | ')} |`);
  }
  return lines.join('\n');
}

function add(a, b) {
  return (
    a &&
    b && {
      requests: a.requests + b.requests,
      jsFiles: a.jsFiles + b.jsFiles,
      jsRaw: a.jsRaw + b.jsRaw,
      jsGzip: a.jsGzip + b.jsGzip,
    }
  );
}

function todosRows(result, metrics) {
  const fw = result.frameworks;
  const rows = [];
  function browser(name) {
    return fw[name].browser;
  }

  if (metrics.has('browser')) {
    rows.push(
      ['**Browser** (3 todos; JS files · raw / gzip)', () => ''],
      ['JS before `load`', (n) => js(browser(n)?.boot)],
      [`JS fetched while idle ${result.options.idleMs / 1000} s`, (n) => js(browser(n)?.idle)],
      ['First counter click: requests', (n) => browser(n)?.firstCounter.requests],
      ['First counter click: JS', (n) => js(browser(n)?.firstCounter)],
      ['First todo toggle: requests', (n) => browser(n)?.firstToggle.requests],
      ['First todo toggle: JS', (n) => js(browser(n)?.firstToggle)],
      ['Total JS after counter, toggle, add', (n) => js(browser(n)?.total)],
      [
        'Click to update (counter / toggle / add)',
        (n) => {
          const checks = browser(n)?.checks.counterFirst;
          return checks && `${ms(checks.counter)} / ${ms(checks.toggle)} / ${ms(checks.add)}`;
        },
      ],
    );
  }
  if (metrics.has('dist')) {
    rows.push(['**Build**', () => ''], ['Client JS emitted in dist', (n) => js(fw[n].dist)]);
  }
  if (metrics.has('ssr-size')) {
    function s(name) {
      return fw[name].ssrSize;
    }
    rows.push(
      ['**SSR HTML** (raw / gzip -9)', () => ''],
      ['0 todos', (n) => s(n) && size(s(n)[0].raw, s(n)[0].gzip)],
      ['3 todos', (n) => s(n) && size(s(n)[3].raw, s(n)[3].gzip)],
      ['100 todos', (n) => s(n) && size(s(n)[100].raw, s(n)[100].gzip)],
      ['Per extra todo', (n) => s(n) && `${num(s(n).perItemRaw)} B / ${num(s(n).perItemGzip)} B`],
    );
  }
  if (metrics.has('ssr-speed')) {
    function s(name, n) {
      return fw[name].ssrSpeed?.[n];
    }
    function cell(name, n) {
      return (
        s(name, n) && `${num(s(name, n).median)} (${num(s(name, n).min)}–${num(s(name, n).max)})`
      );
    }
    rows.push(
      [`**SSR renders/s** (median of ${result.options.rounds}, min–max)`, () => ''],
      ['3 todos', (n) => cell(n, 3)],
      ['100 todos', (n) => cell(n, 100)],
    );
  }
  if (metrics.has('waterfall')) {
    function w(name, kind) {
      return fw[name].waterfall?.[kind];
    }
    function cell(name, kind) {
      return (
        w(name, kind) &&
        `${w(name, kind).roundTrips} RT · ${w(name, kind).requests} req · ${ms(w(name, kind).ms)}`
      );
    }
    rows.push(
      [`**First counter click, ${result.options.latency} ms RTT**`, () => ''],
      ['After idle', (n) => cell(n, 'idle')],
      ['Right after load (cold)', (n) => cell(n, 'cold')],
    );
  }
  return rows;
}

export function markdown(result, metrics) {
  const names = result.options.frameworks;
  const fw = result.frameworks;
  const labels = {};
  for (const name of names) {
    labels[name] = fw[name].label;
  }
  const scenarios = result.options.scenarios ?? ['todos'];

  const m = result.machine;
  const versionParts = [];
  for (const name of names) {
    const deps = [];
    for (const [dep, v] of Object.entries(result.versions[name])) {
      deps.push(`${dep}@${v}`);
    }
    versionParts.push(`${labels[name]}: ${deps.join(', ')}`);
  }
  const headerLines = [
    `# Benchmark results ${result.date}`,
    '',
    `- Machine: ${m.cpu}, ${m.cores} cores, ${m.memoryGb} GB, ${m.platform}`,
    `- Node ${m.node}; load average ${m.loadAvg.join(' ')} at start, ${m.loadAvgEnd.join(' ')} at end`,
    result.browser
      ? `- Browser: ${result.browser.version} (${result.browser.executable})`
      : undefined,
    result.git
      ? `- idlip: ${result.git.commit}${result.git.dirty ? ' with uncommitted changes in packages/' : ''}`
      : undefined,
    `- Versions: ${versionParts.join('; ')}`,
    `- Scenarios: ${scenarios.join(', ')}`,
    `- Took ${result.durationSeconds} s`,
  ];
  const header = [];
  for (const line of headerLines) {
    if (line !== undefined) {
      header.push(line);
    }
  }
  const notes = [];
  if (result.notes.length) {
    notes.push('', '## Notes', '');
    for (const note of result.notes) {
      notes.push(`- ${note}`);
    }
  }
  const sections = [];
  if (scenarios.includes('todos'))
    sections.push('', '## Todos', '', table(names, labels, todosRows(result, metrics)));
  return `${[...header, ...sections, ...notes].join('\n')}\n`;
}
