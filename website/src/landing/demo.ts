// oxlint-disable import/prefer-default-export
// The live demo: `examples/todo` in a frame, rendered by idlip at build time and resumed in the
// page, beside a panel that lists each request the frame makes. `client/demo.ts` fills the panel.
import type { DemoData } from '../demo/data.ts';
import { ICON } from '../layout.ts';

export function renderDemo(data: DemoData, base: string): string {
  return `<section class="demo-section" aria-labelledby="demo-title">
  <h2 class="row-title" id="demo-title">Check a todo</h2>
  <p class="row-lead">This is <code>examples/todo</code>, rendered by idlip when this site was built. The panel lists what the frame loads, as the browser reports it.</p>
  <div class="demo" data-demo>
    <div class="demo-app">
      <div class="demo-bar"><span>${base}${data.frame}</span><button class="icon-button" type="button" data-demo-reload aria-label="Reload the demo" title="Reload the demo">${ICON.reload}</button></div>
      <iframe class="demo-frame" src="${base}${data.frame}" title="The todo example" data-demo-frame></iframe>
    </div>
    <div class="demo-net" data-net>
      <h3 class="net-head">Network</h3>
      <p class="net-group">On load</p>
      <ul class="net-list" data-net-load><li class="net-empty">Loading the frame</li></ul>
      <p class="net-group">On your events</p>
      <ul class="net-list net-click" data-net-events><li class="net-empty">Nothing yet. Check a todo.</li></ul>
      <p class="net-total"><span>Component code on load</span><span data-net-code-load>0 B</span></p>
      <p class="net-total"><span>Component code on events</span><span data-net-code-events>0 B</span></p>
    </div>
  </div>
</section>`;
}
