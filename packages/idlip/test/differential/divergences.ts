/**
 * The differences between the server render and the client render that are accepted. A
 * difference that no run produces fails the test, so an entry goes when its cause is fixed.
 */
export interface Divergence {
  readonly id: string;
  /** Subject names where it occurs. */
  readonly subjects: readonly string[];
  /** Matches the message of `compareTrees`. */
  readonly pattern: RegExp;
  readonly reason: string;
}

export const DIVERGENCES: readonly Divergence[] = [
  {
    id: 'caught-region-stays',
    subjects: ['try-board'],
    pattern:
      /comment <!--e\d+:0-->\[\d+\]: the server render has comment <!--e\d+:0-->, the page has comment <!--e\d+:1-->/,
    reason:
      'A `<Try>` region that caught stays on its catch view until `reset` renders the body again (proposal 0004). A kept row whose model recovers keeps the catch view, while a server render of the new model shows the body.',
  },
  {
    id: 'input-value-newline',
    subjects: ['todo', 'example-todo', 'rich'],
    pattern: /attribute value is "[^"]*" in the page and "[^"]*\\n[^"]*" in the server render/,
    reason:
      'The `value` setter of an input drops line breaks. happy-dom reads the raw attribute of a server-rendered input, so the live value and the fresh one differ on a string with `\\n`. A browser sanitizes both.',
  },
];

/** Returns the accepted divergence that explains a difference, if any. */
export function findDivergence(subject: string, difference: string): Divergence | undefined {
  for (const divergence of DIVERGENCES) {
    if (divergence.subjects.includes(subject) && divergence.pattern.test(difference)) {
      return divergence;
    }
  }
  return undefined;
}
