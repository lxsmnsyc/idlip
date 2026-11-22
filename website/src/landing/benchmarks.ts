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
  /** The frameworks run on no app. */
  absent: string[];
  /** The frameworks run on some apps but not all. */
  partial: string[];
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
  const absent: string[] = [];
  const partial: string[] = [];
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
    } else if (values.length === 0) {
      absent.push(name);
    } else {
      partial.push(name);
    }
  }
  return { apps, unit: metrics[0].unit, rows, absent, partial };
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
    bars += `<li class="grow-bar grow-bar-${index}" style="--i:${index}"><span class="grow-app">${escape(growth.apps[index])}</span><span class="grow-track"><span class="grow-fill" style="width:${width}%"></span><span class="grow-value">${formatValue(value, growth.unit)}</span></span></li>`;
  }
  const first = row.values[0];
  const last = row.values.at(-1) ?? first;
  const delta = `×${(last / first).toFixed(1)}`;
  const mark = own ? ' is-own' : '';
  return `<div class="grow-row${mark}" role="listitem"><p class="grow-name">${escape(row.name)}</p><ul class="grow-bars">${bars}</ul><p class="grow-delta"><span class="visually-hidden">Grows </span>${delta}</p></div>`;
}

/** Joins names for a sentence: `a`, `a and b`, `a, b and c`. */
function joinNames(names: readonly string[]): string {
  if (names.length < 2) {
    return names.join('');
  }
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1) ?? ''}`;
}

/** idlip's cost when it stays within 10% from the smallest app to the largest, else `undefined`. */
function readFlatCost(
  growth: Growth,
  own: string,
): { value: number; small: string; large: string } | undefined {
  let mine: number[] = [];
  for (const row of growth.rows) {
    if (row.name === own) {
      mine = row.values;
    }
  }
  const first = mine[0];
  const last = mine.at(-1);
  if (first === undefined || last === undefined || last > first * 1.1) {
    return undefined;
  }
  return { value: last, small: growth.apps[0], large: growth.apps.at(-1) ?? growth.apps[0] };
}

export interface Headline {
  before: string;
  /** The highlighted part: the number, or the fallback's key words. */
  value: string;
  after: string;
  /** The conditions of the number, or an empty string for the fallback. */
  conditions: string;
}

/** The hero headline: the flat cost as a number, or a plain headline when the data is not flat. */
export function writeHeadline(data: Benchmarks): Headline {
  const growth = readGrowth(data);
  const flat = readFlatCost(growth, data.frameworks[0]);
  if (flat === undefined) {
    return { before: 'Pages that run no view code ', value: 'on load', after: '.', conditions: '' };
  }
  return {
    before: 'Pages ready on ',
    value: formatValue(flat.value, growth.unit),
    after: ' of JavaScript, at any size.',
    conditions: `From ${flat.small} to ${flat.large}, gzip, before the load event.`,
  };
}

/**
 * The lead under the heading, from the data: when idlip's cost stays within 10% from the smallest
 * app to the largest, it names that cost and both app sizes.
 */
function writeLead(growth: Growth, own: string): string {
  const flat = readFlatCost(growth, own);
  if (flat === undefined) {
    return 'idlip runs no component code on load. Code arrives with the first click that needs it.';
  }
  return `With ${escape(flat.small)} or ${escape(flat.large)}, idlip loads the same ${formatValue(flat.value, growth.unit)} of JavaScript before the page is ready. The code of each widget arrives with the first click that needs it.`;
}

/** The startup chart: how much JavaScript each framework loads as the app grows. */
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
  let notes = '';
  if (growth.absent.length > 0) {
    notes += ` ${escape(joinNames(growth.absent))} ${growth.absent.length === 1 ? 'was' : 'were'} not run.`;
  }
  if (growth.partial.length > 0) {
    notes += ` ${escape(joinNames(growth.partial))} ran on some sizes only.`;
  }
  return `<section aria-labelledby="benchmarks">
  <h2 class="row-title" id="benchmarks">Your app grows. Its startup doesn't.</h2>
  <p class="row-lead">${writeLead(growth, own)}</p>
  <div class="tile grow-tile">
    <div class="grow-chart" role="list" aria-label="JavaScript before the page is ready, gzip, per framework">${rows}</div>
    <p class="tile-foot">JavaScript loaded before the <code>load</code> event, gzip. Run on ${escape(data.date)}, ${escape(data.machine)}.${notes} <a href="${link}">All results and how they were measured</a></p>
  </div>
</section>`;
}
