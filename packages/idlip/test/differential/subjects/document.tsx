// A document component: `<html>`, `<head>` and `<body>` with bound attributes and a bound title.
// oxlint-disable typescript/no-confusing-void-expression, typescript/explicit-function-return-type, typescript/no-unnecessary-condition
import type { JSX } from 'idlip/jsx-runtime';

export default function Page(props: { count: number }): JSX.Element {
  let lang = 'en';
  let count = props.count;
  let dark = false;

  const title = `${count} clicks`;
  const theme = dark ? 'dark' : 'light';

  function setFrench() {
    lang = 'fr';
  }
  function setEnglish() {
    lang = 'en';
  }
  function click() {
    count = count + 1;
  }
  function toggle() {
    dark = !dark;
  }

  return (
    <html lang={lang}>
      <head>
        <meta charset="utf-8" />
        <meta name="color-scheme" content={theme} />
        <title>{title}</title>
      </head>
      <body class={theme}>
        <button on:click={setFrench}>fr</button>
        <button on:click={setEnglish}>en</button>
        <button on:click={click}>{count}</button>
        <button on:click={toggle}>theme</button>
      </body>
    </html>
  );
}
