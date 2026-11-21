// Every construct the analysis resolves, beyond the todo example.
import { For, Head, Subscribe, Time, Try, trusted } from 'idlip';
import styles from './board.module.css';
import * as fmt from './format';
import { Avatar } from './avatar.idlip';

interface Card {
  id: string;
  title: string;
  done: boolean;
  tags: string[];
  author: { name: string; bio: string };
}
interface Column {
  id: string;
  name: string;
  cards: Card[];
}
type Load = { state: 'idle' } | { state: 'loading' } | { state: 'failed'; error: string };
type Filter = 'all' | 'open' | 'done';

const LABELS = { all: 'All', open: 'Open', done: 'Done' };

async function* every(ms: number, signal: AbortSignal) {
  while (true) {
    await Time.sleep(ms, signal);
    yield await Time.now();
  }
}

// One return expression: inlined, so paths are exact.
function isVisible(card: Card, filter: Filter): boolean {
  return filter === 'all' || (filter === 'done' ? card.done : !card.done);
}
function title(card: Card): string {
  return `${card.title} (${card.tags.length})`;
}
const upper = (text: string) => text.toUpperCase();

// A loop body: not inlined, so paths are the union of argument paths.
function countDone(columns: readonly Column[]): number {
  let done = 0;
  for (const column of columns) for (const card of column.cards) if (card.done) done++;
  return done;
}

// Stateless: inlined at each use.
function Badge(props: { label: string; on: boolean; children?: unknown }) {
  const tone = props.on ? styles.on : styles.off;
  return (
    <span class={tone}>
      {props.label}
      {props.children}
    </span>
  );
}

function CardRow({ card, onPick }: { card: Card; onPick: () => void }) {
  return (
    <li class={{ done: card.done }} on:click={onPick}>
      <Badge label={title(card)} on={card.done}>
        <em>{card.author.name}</em>
      </Badge>
    </li>
  );
}

// Stateful: a child block with its own slot.
export function Counter(props: { start: number; onDone: () => void }) {
  let count = props.start;
  function increment() {
    count = count + 1;
  }
  return (
    <button on:click={increment} title={`${count}`}>
      {count}
    </button>
  );
}

export default function Board(props: { columns: Column[] }) {
  let columns = props.columns;
  let filter = 'all' satisfies Filter as Filter;
  let selected = '';
  let load = { state: 'idle' } satisfies Load as Load;
  let ticks = 0;
  let live = false;

  const active = filter;
  const heading = `${LABELS[filter]} cards`;
  const done = countDone(columns);
  const first = columns[0];

  function setFilter(next: Filter) {
    filter = next;
  }
  function pick(id: string) {
    selected = id;
  }
  function tick(now: number) {
    ticks = ticks + 1;
    void now;
  }
  function toggleLive() {
    live = !live;
  }
  function key(name: string) {
    if (name === 'Escape') selected = '';
  }
  function moved(x: number) {
    void x;
  }
  async function reload() {
    load = { state: 'loading' };
    const started = selected;
    try {
      const fresh = await fmt.fetchColumns(started);
      columns = fresh;
      load = { state: 'idle' };
    } catch (error) {
      load = { state: 'failed', error: String(error) };
    }
  }

  return (
    <main class={styles.board}>
      <Head>
        <title>{heading}</title>
        <meta name="description" content={`${done} done`} />
      </Head>
      <window on:keydown={(e) => key(e.key)} latest:pointermove={(e) => moved(e.clientX)} />
      {live && <Subscribe to={every} input={1000} on:value={tick} />}
      <h1 ref="heading">{upper(heading)}</h1>
      <p>
        {LABELS[active]} {first?.name}
      </p>
      <nav>
        <button on:click={() => setFilter('all')} aria-pressed={active === 'all'}>
          All
        </button>
        <button on:click={() => setFilter('done')} aria-pressed={filter === 'done'}>
          Done
        </button>
        <button on:click={toggleLive}>{live ? 'Stop' : 'Live'}</button>
        <button on:click={reload} disabled={load.state === 'loading'}>
          Reload
        </button>
      </nav>
      {load.state === 'loading' ? (
        <p>Loading</p>
      ) : load.state === 'failed' ? (
        <p class={styles.error}>{load.error}</p>
      ) : null}
      <Try
        catch={(error, reset) => (
          <p>
            Failed: {fmt.message(error)} <button on:click={reset}>Retry</button>
          </p>
        )}
      >
        <For each={columns} key="id">
          {(column, index) => (
            <section>
              <h2>
                {index + 1}. {column.name}
              </h2>
              <ul>
                <For each={column.cards} key="id">
                  {(card) =>
                    isVisible(card, filter) && <CardRow card={card} onPick={() => pick(card.id)} />
                  }
                </For>
              </ul>
              <Counter start={column.cards.length} onDone={() => pick(column.id)} />
            </section>
          )}
        </For>
      </Try>
      <For each={columns[0].cards} key="id">
        {({ id, author }) => (
          <div ref={['card', id]} class={selected === id ? styles.selected : undefined}>
            <Avatar name={author.name} />
            <div html={trusted(author.bio)} />
          </div>
        )}
      </For>
      <svg viewBox="0 0 10 10">
        <title>{`${ticks} ticks`}</title>
        {ticks > 0 && <circle r={ticks} />}
      </svg>
      <Counter key="main" start={done} onDone={toggleLive} />
      <p>
        {String(ticks)} {Math.max(ticks, 1)} {heading.trim()} {heading.length}
      </p>
      <footer>
        {fmt.count(done, columns.length)} · {ticks}
      </footer>
    </main>
  );
}
