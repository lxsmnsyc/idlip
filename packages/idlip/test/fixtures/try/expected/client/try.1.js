import { text$ } from 'idlip/helpers';

export function render(error) {
return `<em>${text$(error)}</em>`;
}
