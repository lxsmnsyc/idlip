import { clone$, putText$ } from 'idlip/helpers';

const templateE1_1$ = { h: '<em><!--x1--></em>', n: 1 };

export function render(error, $scope, $doc) {
const $n = clone$(templateE1_1$, $doc);
putText$($n[1], error);
return $n[0];
}
