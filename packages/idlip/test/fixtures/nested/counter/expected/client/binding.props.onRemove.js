import { setOn$ } from 'idlip/helpers';

export function a2(el, { props }) {
setOn$(el, 'click', props.onRemove);
}
