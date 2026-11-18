/**
 * A message as it travels through the app: a tag and a payload.
 * It must stay plain data, because the server writes it into the HTML.
 */
export interface Message<Tag extends string = string, Payload = unknown> {
  readonly t: Tag;
  readonly p: Payload;
}

/**
 * One constructor per message tag. A tag whose payload is `undefined` takes no argument.
 */
export type MessageConstructors<Spec> = {
  readonly [Tag in keyof Spec & string]: [Spec[Tag]] extends [undefined]
    ? () => Message<Tag, undefined>
    : (payload: Spec[Tag]) => Message<Tag, Spec[Tag]>;
};

/**
 * Any message described by a spec, as a union of its tags.
 */
export type MessageOf<Spec> = {
  [Tag in keyof Spec & string]: Message<
    Tag,
    [Spec[Tag]] extends [undefined] ? undefined : Spec[Tag]
  >;
}[keyof Spec & string];

/**
 * Creates a message from its tag and payload.
 */
export function createMessage<Tag extends string, Payload>(
  tag: Tag,
  payload: Payload,
): Message<Tag, Payload> {
  return { t: tag, p: payload };
}

/**
 * Creates the message constructors for a spec.
 * The spec exists only as a type, so the constructors are made on first access.
 */
export function defineMessages<Spec>(): MessageConstructors<Spec> {
  const constructors = new Map<string, (payload?: unknown) => Message>();

  // The target stays empty. Every read goes through `get`, which builds the constructor.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return new Proxy({} as MessageConstructors<Spec>, {
    get(_target, tag): unknown {
      if (typeof tag !== 'string') {
        return undefined;
      }

      // Each tag keeps one constructor, so repeated reads return the same function.
      let construct = constructors.get(tag);
      if (!construct) {
        construct = (payload?: unknown): Message => createMessage(tag, payload);
        constructors.set(tag, construct);
      }
      return construct;
    },
  });
}
