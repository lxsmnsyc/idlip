// oxlint-disable import/prefer-default-export
/**
 * The `sandbox` attribute of a frame that runs reader code. It has `allow-scripts` and no
 * `allow-same-origin`, so the frame gets an opaque origin: no access to the page, to the site's
 * storage or to its cookies, and no navigation of the page. Forms, popups and modals stay off.
 */
export const FRAME_SANDBOX = 'allow-scripts';
