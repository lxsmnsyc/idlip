// oxlint-disable import/prefer-default-export
/**
 * The early events listener. A page puts `renderListener()` in `<head>`, before the markup of
 * `render()`. It adds one document listener per event type a state record names, applies the
 * key filter and the modifiers, and queues a `QueuedEvent` in
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
var a='on:'+t,u=[],x,m,o,r=[],v,j;
for(x of l){
v=x.getAttribute(a);j=v[0]=='[';
try{m=j?JSON.parse(v):(o=v.split(/ (.*)/),[o[0],,o[1]])}catch(_){continue}
o=(m[2]||'').split(' ');
if(o.some(f=>f.slice(0,4)=='key:'&&!ok(f.slice(4),e)))continue;
if(o.includes('capture'))r.unshift([x,m,o,j]);else u.push([x,m,o,j])
}
r.concat(u).some(([x,m,o,j])=>{
if((o.includes('prevent')||o.some(f=>f.slice(0,8)=='prevent:'&&ok(f.slice(8),e)))&&!o.includes('passive'))e.preventDefault();
if(o.includes('once'))x.removeAttribute(a);
q.push({...(j?{message:{t:m[0],p:m[1]}}:{site:m[0],event:e,current:c||x}),target:x,type:t,latest:o.includes('latest'),owner:m[3]});
if(o.includes('stop')){e.stopImmediatePropagation();return 1}
})
},
add=r=>r[0].split(' ').map(t=>{
var p=t.endsWith(':passive'),g=/:(window|document)$/.exec(t),a,z,c;
if(g){
t=t.slice(0,-g[0].length);
z='template[i-global='+g[1]+'][on\\:'+t+']';
c=g[1]=='window'?w:d;
if(!s[g[1]+t]){
s[g[1]+t]=1;
c.addEventListener(t,e=>go(e,t,d.querySelectorAll(z),c))
}
return
}
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
