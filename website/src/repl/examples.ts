// The examples of the REPL. The todo and the nesting examples are the apps in `examples/`, so
// they stay the code the e2e tests run.
import board from '../../../examples/counters/src/board.tsx?raw';
import counter from '../../../examples/counters/src/counter.tsx?raw';
import todo from '../../../examples/todo/src/todo.tsx?raw';
import { PROPS_FILE } from './files.ts';
import type { ReplFile } from './files.ts';

export interface Example {
  id: string;
  label: string;
  files: ReplFile[];
}

/** Drops the comment lines at the top of a file: they are notes for the repo. */
function dropLeadingComments(source: string): string {
  const lines = source.split('\n');
  let start = 0;
  while (start < lines.length && lines[start].startsWith('//')) {
    start += 1;
  }
  return lines.slice(start).join('\n');
}

function writeProps(props: unknown): ReplFile {
  return { name: PROPS_FILE, source: `${JSON.stringify(props, null, 2)}\n` };
}

const COUNTER = `import type { JSX } from 'idlip/jsx-runtime';

export default function Counter(props: { start: number }): JSX.Element {
  let count = props.start;

  const double = count * 2;

  function increment() {
    count = count + 1;
  }
  function decrement() {
    count = count - 1;
  }

  return (
    <main>
      <button on:click={decrement}>-</button>
      <output>{count}</output>
      <button on:click={increment}>+</button>
      <p>Double: {double}</p>
    </main>
  );
}
`;

const FORM = `import { For } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Guest {
  id: string;
  name: string;
  seats: number;
}

export default function Guests(): JSX.Element {
  let guests = [] satisfies Guest[] as Guest[];

  function add(name: string, seats: number) {
    guests = [...guests, { id: \`g\${guests.length}\`, name, seats }];
  }

  return (
    <main>
      <form
        on:submit={(e) => {
          e.preventDefault();
          add(e.currentTarget.elements.name.value, e.currentTarget.elements.seats.valueAsNumber);
        }}
      >
        <input name="name" placeholder="Name" required />
        <input name="seats" type="number" value="1" min="1" />
        <button>Add</button>
      </form>
      <ul>
        <For each={guests} key={(guest) => guest.id}>
          {(guest) => (
            <li>
              {guest.name}: {guest.seats}
            </li>
          )}
        </For>
      </ul>
    </main>
  );
}
`;

const SUBSCRIPTION = `import { Subscribe, timer } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

type Clock = { state: 'stopped' } | { state: 'running'; ms: number; now: number };

export default function Ticker(): JSX.Element {
  let clock = { state: 'stopped' } satisfies Clock as Clock;

  function start(ms: number) {
    clock = { state: 'running', ms, now: 0 };
  }
  function stop() {
    clock = { state: 'stopped' };
  }
  function tick(now: number) {
    if (clock.state === 'running') {
      clock = { ...clock, now };
    }
  }

  return (
    <main>
      <button on:click={() => start(1000)}>Every second</button>
      <button on:click={stop}>Stop</button>
      {clock.state === 'running' && (
        <Subscribe key={clock.ms} to={timer} input={clock.ms} on:value={tick} />
      )}
      <p>{clock.state === 'running' ? clock.now : 'stopped'}</p>
    </main>
  );
}
`;

const EFFECT = `import { For, Random, Time } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

interface Note {
  id: string;
  at: number;
}

export default function Notes(): JSX.Element {
  let notes = [] satisfies Note[] as Note[];

  async function add() {
    const id = await Random.id();
    const at = await Time.now();
    notes = [...notes, { id, at }];
  }

  return (
    <main>
      <button on:click={add}>Add a note</button>
      <p>{notes.length} notes</p>
      <ul>
        <For each={notes} key={(note) => note.id}>
          {(note) => (
            <li>
              {note.id} at {note.at}
            </li>
          )}
        </For>
      </ul>
    </main>
  );
}
`;

export const EXAMPLES: readonly Example[] = [
  {
    id: 'counter',
    label: 'Counter',
    files: [{ name: 'counter.tsx', source: COUNTER }, writeProps({ start: 0 })],
  },
  {
    id: 'todo',
    label: 'Todo',
    files: [
      { name: 'todo.tsx', source: dropLeadingComments(todo) },
      writeProps({
        initial: [
          { id: 't1', text: 'Write the view', done: true },
          { id: 't2', text: 'Check a todo', done: false },
        ],
      }),
    ],
  },
  {
    id: 'form',
    label: 'Form',
    files: [{ name: 'guests.tsx', source: FORM }, writeProps({})],
  },
  {
    id: 'subscription',
    label: 'Subscription',
    files: [{ name: 'ticker.tsx', source: SUBSCRIPTION }, writeProps({})],
  },
  {
    id: 'effect',
    label: 'Effect',
    files: [{ name: 'notes.tsx', source: EFFECT }, writeProps({})],
  },
  {
    id: 'nesting',
    label: 'Nesting',
    files: [
      { name: 'board.tsx', source: dropLeadingComments(board) },
      { name: 'counter.tsx', source: dropLeadingComments(counter) },
      writeProps({
        items: [
          { id: 'a1', label: 'Apples', start: 0 },
          { id: 'a2', label: 'Pears', start: 3 },
        ],
      }),
    ],
  },
];
