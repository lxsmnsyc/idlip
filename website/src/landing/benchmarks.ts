// The benchmark table, read from `src/benchmarks.json` so later runs change the numbers only.
import { escape } from '../layout.ts';
import { formatCount } from './format.ts';

export interface Metric {
  name: string;
  unit: 'kB' | 'B' | 'MB' | 'ms' | '/s';
  better: 'lower' | 'higher';
  /** The share within which two values count as even, such as 0.2 for timings. */
  noise: number;
  /** A value per framework, `null` where it was not run. */
  values: Record<string, number | null>;
  /** A short name for the app the metric measures, for the landing chart. */
  label?: string;
}

export interface Benchmarks {
  date: string;
  machine: string;
  /** The file of the repo that holds the full results. */
  source: string;
  /** The column order. The first is idlip. */
  frameworks: string[];
  groups: { name: string; metrics: Metric[] }[];
  /**
   * The group the landing page charts: one metric per app, from the smallest app to the largest,
   * so the chart shows how the cost grows with the app.
   */
  headline: string;
}

const UNITS: readonly string[] = ['kB', 'B', 'MB', 'ms', '/s'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMetric(value: unknown): value is Metric {
  if (!isRecord(value) || !isRecord(value.values)) {
    return false;
  }
  for (const item of Object.values(value.values)) {
    if (item !== null && typeof item !== 'number') {
      return false;
    }
  }
  return (
    typeof value.name === 'string' &&
    typeof value.unit === 'string' &&
    UNITS.includes(value.unit) &&
    (value.better === 'lower' || value.better === 'higher') &&
    typeof value.noise === 'number'
  );
}

/** Checks the shape of `benchmarks.json`, so a later run that breaks it fails the build. */
export function isBenchmarks(value: unknown): value is Benchmarks {
  if (
    !isRecord(value) ||
    typeof value.date !== 'string' ||
    typeof value.machine !== 'string' ||
    typeof value.source !== 'string' ||
    typeof value.headline !== 'string' ||
    !Array.isArray(value.frameworks) ||
    !Array.isArray(value.groups)
  ) {
    return false;
  }
  for (const group of value.groups as unknown[]) {
    if (!isRecord(group) || typeof group.name !== 'string' || !Array.isArray(group.metrics)) {
      return false;
    }
    for (const metric of group.metrics as unknown[]) {
      if (!isMetric(metric)) {
        return false;
      }
    }
  }
  return true;
}

function formatValue(value: number, unit: Metric['unit']): string {
  if (unit === '/s') {
    return `${formatCount(value)}/s`;
  }
  if (unit === 'B') {
    return `${formatCount(value)} B`;
  }
  return `${String(Number(value.toFixed(1)))} ${unit}`;
}

export interface Growth {
  /** The apps, smallest first. */
  apps: string[];
  unit: Metric['unit'];
  /** The frameworks measured on every app, with one value per app. */
  rows: { name: string; values: number[] }[];
  /** The frameworks left out because an app was not run on them. */
  missing: string[];
}

/** The headline group as a chart: each framework's cost on each app, smallest app first. */
export function readGrowth(data: Benchmarks): Growth {
  let metrics: Metric[] = [];
  for (const group of data.groups) {
    if (group.name === data.headline) {
      metrics = group.metrics;
    }
  }
  if (metrics.length < 2) {
    throw new TypeError(
      `benchmarks.json: the headline group "${data.headline}" needs two or more metrics`,
    );
  }
  const apps: string[] = [];
  for (const metric of metrics) {
    apps.push(metric.label ?? metric.name);
  }
  const rows: Growth['rows'] = [];
  const missing: string[] = [];
  for (const name of data.frameworks) {
    const values: number[] = [];
    for (const metric of metrics) {
      const value = metric.values[name];
      if (typeof value === 'number') {
        values.push(value);
      }
    }
    if (values.length === metrics.length) {
      rows.push({ name, values });
    } else {
      missing.push(name);
    }
  }
  return { apps, unit: metrics[0].unit, rows, missing };
}

/** One framework: a bar per app, scaled to the largest value in the chart, and the growth. */
function renderGrowthRow(
  row: Growth['rows'][number],
  growth: Growth,
  max: number,
  own: boolean,
): string {
  let bars = '';
  for (const [index, value] of row.values.entries()) {
    const width = Math.max((value / max) * 100, 1).toFixed(1);
    bars += `<li class="grow-bar grow-bar-${index}"><span class="grow-fill" style="width:${width}%"></span><span class="grow-value">${formatValue(value, growth.unit)}</span><span class="visually-hidden"> on ${escape(growth.apps[index])}</span></li>`;
  }
  const first = row.values[0];
  const last = row.values.at(-1) ?? first;
  const delta = `+${formatValue(Math.max(last - first, 0), growth.unit)}`;
  const mark = own ? ' is-own' : '';
  return `<div class="grow-row${mark}" role="listitem"><p class="grow-name">${escape(row.name)}</p><ul class="grow-bars">${bars}</ul><p class="grow-delta"><span class="visually-hidden">Grows by </span>${delta}</p></div>`;
}

/** The startup chart: how much JavaScript each framework runs on load as the app grows. */
export function renderBenchmarks(data: Benchmarks, link: string): string {
  const growth = readGrowth(data);
  let max = 0;
  for (const row of growth.rows) {
    for (const value of row.values) {
      max = Math.max(max, value);
    }
  }
  const [own] = data.frameworks;
  let rows = '';
  for (const row of growth.rows) {
    rows += renderGrowthRow(row, growth, max, row.name === own);
  }
  let legend = '';
  for (const [index, app] of growth.apps.entries()) {
    legend += `<li class="grow-key grow-key-${index}">${escape(app)}</li>`;
  }
  const missing =
    growth.missing.length > 0
      ? ` ${escape(growth.missing.join(' and '))} ran only on the smaller app.`
      : '';
  return `<section aria-labelledby="benchmarks">
  <h2 class="row-title" id="benchmarks">Your app grows. Its startup doesn't.</h2>
  <p class="row-lead">idlip runs no component code on load, so a bigger app adds almost nothing to what the page loads before it responds.</p>
  <div class="tile grow-tile">
    <ul class="grow-legend" aria-label="Apps">${legend}<li class="grow-key grow-key-delta">Growth</li></ul>
    <div class="grow-chart" role="list" aria-label="JavaScript on load, gzip, per framework">${rows}</div>
    <p class="tile-foot">JavaScript loaded before the first click, gzip. Run on ${escape(data.date)}, ${escape(data.machine)}.${missing} <a href="${link}">All results and how they were measured</a></p>
  </div>
</section>`;
}
