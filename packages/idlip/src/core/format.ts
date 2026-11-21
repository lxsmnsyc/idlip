/**
 * Internal types shared by the compiler and the runtime. They are not exported
 * from `idlip`. `contracts/compiled-format.md` owns the rest of this file.
 */

/**
 * A message as it travels through the app: a handler's tag and its arguments.
 * It stays plain data, because the server writes it into the HTML.
 */
export interface Message<Tag extends string = string, Payload = unknown> {
  readonly t: Tag;
  readonly p: Payload;
}
