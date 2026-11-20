/**
 * A message as it travels through the app: a tag and a payload.
 * It must stay plain data, because the server writes it into the HTML.
 */
export interface Message<Tag extends string = string, Payload = unknown> {
  readonly t: Tag;
  readonly p: Payload;
}

/**
 * An update handler. A handler with only the model parameter takes no payload.
 */
// oxlint-disable-next-line typescript/no-explicit-any
export type Handler<Model> = (model: Model, payload: any) => Model;

/**
 * The payload type of a handler, or `undefined` when it has no payload parameter.
 */
export type PayloadOf<H> = H extends (model: never) => unknown
  ? undefined
  : H extends (model: never, payload: infer Payload) => unknown
    ? Payload
    : never;

/**
 * Builds the message for one tag. `tag` lets other code name the message without building it.
 */
export type MessageConstructor<Tag extends string, Payload> = ([Payload] extends [undefined]
  ? () => Message<Tag, undefined>
  : (payload: Payload) => Message<Tag, Payload>) & { readonly tag: Tag };

/**
 * One constructor per update handler.
 */
export type MessageConstructors<Handlers> = {
  readonly [Tag in keyof Handlers & string]: MessageConstructor<Tag, PayloadOf<Handlers[Tag]>>;
};

/**
 * Any message the handlers accept, as a union of their tags.
 */
export type MessageOf<Handlers> = {
  [Tag in keyof Handlers & string]: Message<Tag, PayloadOf<Handlers[Tag]>>;
}[keyof Handlers & string];

/**
 * The parts of a module. `update` must come before `view`, because TypeScript
 * infers properties in order and `msg` gets its type from `update`.
 */
export interface ModuleSpec<Model, Handlers> {
  readonly init: () => Model;
  readonly update: Handlers;
  readonly view: (model: Model, msg: MessageConstructors<Handlers>) => unknown;
}

/**
 * Creates a module. The model type is given first, so the handler types can be inferred.
 */
export function defineModule<Model>(): <Handlers extends Record<string, Handler<Model>>>(
  spec: ModuleSpec<Model, Handlers>,
) => ModuleSpec<Model, Handlers> {
  return (spec) => spec;
}

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
 * Creates the message constructors for a set of handlers.
 * The tags exist only as types, so the constructors are made on first access.
 */
export function createConstructors<Handlers>(): MessageConstructors<Handlers> {
  const constructors = new Map<string, (payload?: unknown) => Message>();

  // The target stays empty. Every read goes through `get`, which builds the constructor.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return new Proxy({} as MessageConstructors<Handlers>, {
    get(_target, tag): unknown {
      if (typeof tag !== 'string') {
        return undefined;
      }

      // Each tag keeps one constructor, so repeated reads return the same function.
      let construct = constructors.get(tag);
      if (!construct) {
        construct = Object.assign((payload?: unknown): Message => createMessage(tag, payload), {
          tag,
        });
        constructors.set(tag, construct);
      }
      return construct;
    },
  });
}
