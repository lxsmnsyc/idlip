import { trusted } from 'idlip';
import type { JSX } from 'idlip/jsx-runtime';

// This file is checked by tsc and never runs. The `@ts-expect-error` lines are the type tests:
// a plain string is not `TrustedHtml`, in an HTML element or in an SVG one.

declare const text: string;

export function Ok(): JSX.Element {
  return (
    <main>
      <div html={trusted(text)} />
      <svg>
        <g html={trusted(text)} />
      </svg>
    </main>
  );
}

export function Bad(): JSX.Element {
  return (
    <main>
      {/* @ts-expect-error a plain string is not TrustedHtml */}
      <div html={text} />
      <svg>
        {/* @ts-expect-error a plain string is not TrustedHtml */}
        <g html={text} />
        {/* @ts-expect-error a plain on* attribute is not allowed */}
        <g onload={text} />
      </svg>
    </main>
  );
}
