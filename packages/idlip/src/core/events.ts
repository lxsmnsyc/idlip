/**
 * An event with `currentTarget` typed as the element the listener is on.
 */
export type EventFor<El extends Element, E extends Event> = E & { readonly currentTarget: El };

/**
 * The type of an `on:*` or `latest:*` prop. The compiler restricts the value to a
 * handler, or an arrow function whose body is one handler call.
 */
export type EventProp<El extends Element, E extends Event> = (event: EventFor<El, E>) => unknown;
