// oxlint-disable import/prefer-default-export
/**
 * The early events listener. A page puts `renderListener()` in `<head>`, before the markup of
 * `render()`. It adds one document listener per event type a state record names, applies the
 * key filter and the modifiers, resolves placeholders, and queues a `QueuedEvent` in
 * `self.$idlip.q` for the loader. `contracts/compiled-format.md` (Events, Modifiers,
 * Delegated listening) describes each step.
 */

// The code is written by hand in short names to stay under 1024 B gzip.
const LISTENER = String.raw`((w,d)=>{
var b=w.$idlip||=[],q=b.q||=[],s={},
M=/Mac|iP/.test(navigator.platform),
ok=(f,e)=>{
var m=/^((?:(?:Ctrl|Alt|Shift|Meta|Mod)\+)*)(.+)$/.exec(f),k=m[2];
return(k.length>1?e.key==k:(e.key+'').toLowerCase()==k.toLowerCase())&&m[1].replace('Mod',M?'Meta':'Ctrl').split('+').every(n=>!n||e[n.toLowerCase()+'Key'])
},
go=(e,t,l,c)=>{
var a='on:'+t,u=[],x,m,o,r=[];
for(x of l){
try{m=JSON.parse(x.getAttribute(a))}catch(_){continue}
o=(m[2]||'').split(' ');
if(o.some(f=>f.slice(0,4)=='key:'&&!ok(f.slice(4),e)))continue;
if(o.includes('capture'))r.unshift([x,m,o]);else u.push([x,m,o])
}
r.concat(u).some(([x,m,o])=>{
if(o.includes('prevent')&&!o.includes('passive'))e.preventDefault();
if(o.includes('once'))x.removeAttribute(a);
q.push({message:{t:m[0],p:m[1].map(v=>Array.isArray(v)&&typeof v[0]=='string'&&v[0][0]=='$'?v[0]=='$'?v.slice(1):v[0]=='$event'?v.slice(1).reduce((n,k)=>n==null?n:n==e&&k=='currentTarget'?c||x:n[k],e):v:v)},target:x,type:t,latest:o.includes('latest'),owner:m[3]});
if(o.includes('stop')){e.stopImmediatePropagation();return 1}
})
},
add=r=>r[0].split(' ').map(t=>{
var p=t.endsWith(':passive'),a;
t=t.replace(':passive','');
a='on:'+t;
if(s[t]==null||s[t]&&!p){
s[t]=p;
for(let n of[0,1])d.addEventListener(t,e=>{
var l=[],x=e.target;
if(s[t]!=p||e.bubbles!=n)return;
if(n)for(;x;x=x.parentNode){if(x.hasAttribute?.(a))l.push(x)}
else if(x.hasAttribute?.(a))l=[x];
go(e,t,l)
},{capture:!n,passive:p})
}
for(let g of['window','document']){
let z='template[i-global='+g+'][on\\:'+t+']',c=g=='window'?w:d;
if(!s[g+t]&&d.querySelector(z)){
s[g+t]=1;
c.addEventListener(t,e=>go(e,t,d.querySelectorAll(z),c))
}
}
}),
o=b.push;
b.push=r=>{o.call(b,r);add(r)};
b.map(add)
})(self,document)`.replaceAll('\n', '');

/**
 * Returns the listener `<script>` tag for the page's `<head>`. `nonce` is written as the
 * script's `nonce` attribute.
 */
export function renderListener(options: { nonce?: string } = {}): string {
  const { nonce } = options;
  const attribute =
    nonce === undefined
      ? ''
      : ` nonce="${nonce.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"`;
  return `<script${attribute}>${LISTENER}</script>`;
}
