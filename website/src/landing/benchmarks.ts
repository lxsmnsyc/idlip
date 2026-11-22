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
}

export interface Benchmarks {
  date: string;
  machine: string;
  /** The file of the repo that holds the full results. */
  source: string;
  /** The column order. The first is idlip. */
  frameworks: string[];
  groups: { name: string; metrics: Metric[] }[];
}

type Verdict = 'ahead' | 'even' | 'behind';

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
  return `${unit === 'B' ? formatCount(value) : String(value)} ${unit}`;
}

/** Whether `a` is better than `b` for this metric. */
function isBetter(metric: Metric, a: number, b: number): boolean {
  return metric.better === 'lower' ? a < b : a > b;
}

/** idlip against the best of the others: ahead, even within the noise, or behind. */
export function judge(metric: Metric, own: string): { verdict: Verdict; best: number } {
  const mine = metric.values[own];
  let best: number | undefined;
  for (const [name, value] of Object.entries(metric.values)) {
    if (name !== own && value !== null && (best === undefined || isBetter(metric, value, best))) {
      best = value;
    }
  }
  if (mine === null || best === undefined) {
    return { verdict: 'even', best: mine ?? 0 };
  }
  const winner = isBetter(metric, mine, best) ? mine : best;
  const spread = Math.abs(mine - best) / Math.max(Math.abs(mine), Math.abs(best), 1e-9);
  if (mine === best || spread <= metric.noise) {
    return { verdict: 'even', best: winner };
  }
  return { verdict: isBetter(metric, mine, best) ? 'ahead' : 'behind', best: winner };
}

function renderRow(metric: Metric, frameworks: readonly string[]): string {
  const [own, ...others] = frameworks;
  let cells = '';
  for (const name of others) {
    const value = metric.values[name];
    cells +=
      value === null
        ? '<td class="not-run">not run</td>'
        : `<td>${formatValue(value, metric.unit)}</td>`;
  }
  return `<tr><th scope="row">${escape(metric.name)}</th><td class="col-idlip is-best">${formatValue(metric.values[own] ?? 0, metric.unit)}</td>${cells}</tr>`;
}

/**
 * The metrics where idlip leads every framework that ran, by group. The landing page shows these;
 * the full results, losses included, are one link away.
 */
export function pickLeads(data: Benchmarks): { name: string; metrics: Metric[] }[] {
  const [own] = data.frameworks;
  const groups: { name: string; metrics: Metric[] }[] = [];
  for (const group of data.groups) {
    const metrics: Metric[] = [];
    for (const metric of group.metrics) {
      if (judge(metric, own).verdict === 'ahead') {
        metrics.push(metric);
      }
    }
    if (metrics.length > 0) {
      groups.push({ name: group.name, metrics });
    }
  }
  return groups;
}

/** The numbers where idlip leads, with a link to every result. */
export function renderBenchmarks(data: Benchmarks, link: string): string {
  const [own, ...others] = data.frameworks;
  let head = `<th scope="col">Metric</th><th scope="col" class="col-idlip">${escape(own)}</th>`;
  for (const name of others) {
    head += `<th scope="col">${escape(name)}</th>`;
  }
  // Metric and idlip, then one column per other framework.
  const columns = 2 + others.length;
  let body = '';
  for (const group of pickLeads(data)) {
    body += `<tr class="bench-group"><th scope="rowgroup" colspan="${columns}">${escape(group.name)}</th></tr>`;
    for (const metric of group.metrics) {
      body += renderRow(metric, data.frameworks);
    }
  }
  return `<section aria-labelledby="benchmarks">
  <h2 class="row-title" id="benchmarks">Less JavaScript before the first click</h2>
  <div class="tile bench-tile">
    <div class="bench-scroll" tabindex="0" role="group" aria-label="Benchmark table">
      <table class="bench">
        <caption>Run on ${escape(data.date)}, ${escape(data.machine)}. Sizes are gzip.</caption>
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <p class="tile-foot"><a href="${link}">All results and how they were measured</a></p>
  </div>
</section>`;
}
