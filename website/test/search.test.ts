import { describe, expect, it } from 'vitest';
import { buildSearchIndex, htmlToText } from '../src/search/index.ts';
import { search, splitTerms, titleOf } from '../src/search/rank.ts';
import { emptyMessage, renderEmpty, resultsStatus } from '../src/search/view.ts';
import { buildNav, loadPages } from '../src/site.ts';

const pages = loadPages();
const ordered = buildNav(pages).flatMap((section) => section.pages);
const entries = buildSearchIndex(ordered);

describe('the search index', () => {
  it('has an entry per heading of every page, and one for the page itself', () => {
    for (const page of pages) {
      const own = entries.filter((entry) => entry.page === page.url);
      const ids = own.filter((entry) => entry.id !== '').map((entry) => entry.id);
      expect(ids, page.file).toEqual(page.headings.map((heading) => heading.id));
      expect(own.filter((entry) => entry.id === '')).toHaveLength(1);
    }
  });

  it('keeps the heading text and drops the markup', () => {
    for (const entry of entries) {
      expect(entry.text).not.toContain('class="');
      expect(entry.heading).not.toContain('class="');
    }
    expect(htmlToText('<p>a &amp; <code>b</code></p><p>c</p>')).toBe('a & b c');
    // A code block is not indexed. Inline code is.
    expect(
      htmlToText(
        '<p>use <code>let</code></p><div class="code-block"><span class="code-lang">ts</span><button class="code-copy">Copy</button><pre tabindex="0">x</pre></div>',
      ),
    ).toBe('use let');
  });

  it('follows the order of the sidebar', () => {
    expect(entries[0].page).toBe(ordered[0].url);
  });
});

describe('ranking', () => {
  it.each([
    ['subscription', 'docs/subscriptions/'],
    ['subscribe', 'docs/subscriptions/'],
    ['resume', 'docs/resuming/'],
    ['deployment', 'docs/deploying/'],
    ['effect', 'docs/effects/'],
    ['deploy', 'docs/deploying/'],
  ])('puts the page titled for "%s" first', (query, page) => {
    const [first] = search(entries, query);
    expect(first.entry.page).toBe(page);
    expect(first.entry.id).toBe('');
  });

  it('puts a heading match before a text match', () => {
    const results = search(entries, 'refs');
    const firstText = results.findIndex(
      (result) => !result.entry.heading.toLowerCase().includes('ref') && result.entry.id !== '',
    );
    const lastHeading = results.findLastIndex((result) =>
      (result.entry.id === '' ? result.entry.pageTitle : result.entry.heading)
        .toLowerCase()
        .includes('ref'),
    );
    expect(lastHeading).toBeGreaterThanOrEqual(0);
    if (firstText !== -1) {
      expect(lastHeading).toBeLessThan(firstText);
    }
  });

  it('ranks a match at the start of a word before one inside a word', () => {
    const [first] = search(entries, 'list');
    expect(titleOf(first.entry).toLowerCase()).toMatch(/\blist/);
  });

  it('finds words in the text of a section', () => {
    const results = search(entries, 'resumes');
    expect(results.length).toBeGreaterThan(0);
  });

  it('needs every word, and shows at most three results of a page', () => {
    expect(search(entries, 'effect zzzqqq')).toEqual([]);
    const counts = new Map<string, number>();
    for (const result of search(entries, 'the', 50)) {
      counts.set(result.entry.page, (counts.get(result.entry.page) ?? 0) + 1);
    }
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(3);
  });
});

describe('the empty state', () => {
  it('finds nothing for a word that is nowhere, and says so', () => {
    expect(splitTerms('  Zzzqqq  ')).toEqual(['zzzqqq']);
    expect(search(entries, 'zzzqqq')).toEqual([]);
    expect(emptyMessage(' zzzqqq ')).toBe('No results for “zzzqqq”');
  });

  it('renders the message and the link to the guide, escaped', () => {
    expect(renderEmpty(' zzzqqq ', '/docs/')).toBe(
      'No results for “zzzqqq”. <a href="/docs/">Read the guide</a>',
    );
    expect(renderEmpty('<b>"', undefined)).toBe('No results for “&lt;b&gt;&quot;”.');
  });

  it('announces the count with the query, and nothing for an empty query', () => {
    expect(resultsStatus('effect', 1)).toBe('1 result for effect');
    expect(resultsStatus('effect', 4)).toBe('4 results for effect');
    expect(resultsStatus('  ', 5)).toBe('');
  });

  it('finds nothing for an empty query', () => {
    expect(search(entries, '   ')).toEqual([]);
  });
});
