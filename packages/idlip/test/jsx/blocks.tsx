import { Head, Try } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

// This file is checked by tsc and never runs. `<Try>` and `<Head>` take one child or several.

export default function Page(): JSX.Element {
  return (
    <main>
      <Head>
        <title>Todos</title>
        <meta name="description" content="A todo list" />
      </Head>
      <Try catch={(_error, _reset) => <p>Failed</p>}>
        <h1>Todos</h1>
        <p>Body</p>
      </Try>
      <Try catch={() => <p>Failed</p>}>
        <p>One child</p>
      </Try>
    </main>
  );
}
