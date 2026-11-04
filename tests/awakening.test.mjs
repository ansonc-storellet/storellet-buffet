import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAwakening} from '../dist/awakening.mjs';

function setup(reduced=false,hidden=false){
  const doc=new EventTarget(),win=new EventTarget();doc.hidden=hidden;
  globalThis.document=doc;globalThis.window=win;globalThis.matchMedia=()=>({matches:reduced});
  function element(){return {dataset:{},attributes:{},textContent:'',setAttribute(k,v){this.attributes[k]=v;},replaceChildren(...nodes){this.nodes=nodes;}};}
  doc.createElement=element;doc.createTextNode=text=>({textContent:text});
  const panels=Array.from({length:3},element);
  const nodes=Object.fromEntries(['wakeCause','wakeTasteLine','wakeFoodArt','wakeDiner','wakeReward'].map(id=>[id,element()]));
  const skip=new EventTarget(),focus={isConnected:true,disabled:false,restores:0,focus(){doc.activeElement=this;this.restores++;}};
  doc.activeElement=focus;skip.focus=()=>{doc.activeElement=skip;};
  const neighbor={id:'board',inert:false},existing={id:'existing',inert:true},announce={id:'live',inert:false};
  const screen={...element(),hidden:true,style:{setProperty(k,v){this[k]=v;}},querySelectorAll(){return panels;},querySelector(selector){return nodes[selector.slice(1)];}};
  screen.parentElement={children:[screen,neighbor,existing,announce]};
  let now=0,id=0;const timers=new Map();
  globalThis.setTimeout=(fn,ms)=>{timers.set(++id,{at:now+ms,fn});return id;};globalThis.clearTimeout=id=>timers.delete(id);
  function advance(to){while(true){const next=[...timers].filter(([,t])=>t.at<=to).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn();}now=to;}
  return {doc,win,skip,screen,focus,neighbor,existing,announce,nodes,panels,timers,advance,show:createAwakening(screen,skip)};
}
function restored(s){assert.equal(s.screen.hidden,true);assert.equal(s.screen.attributes['aria-hidden'],'true');assert.equal(s.neighbor.inert,false);assert.equal(s.existing.inert,true);assert.equal(s.announce.inert,false);assert.equal(s.doc.activeElement,s.focus);assert.equal(s.timers.size,0);}
const steak={id:'steak',name:'牛扒',category:'food',temperature:'hot'};
const tea={id:'tea',name:'綠茶',category:'drink',temperature:'hot'};
const lime={id:'lime',name:'青檸梳打',category:'drink',temperature:'cold'};
test('three panels reveal at 0/2000/3800 ms and return at 6600 ms without a continue control',async()=>{
 const s=setup(),thumbnail={dataset:{food:'steak'}},p=s.show({food:steak,thumbnail});
 assert.equal(s.show({food:lime}),p);assert.equal(s.neighbor.inert,true);assert.equal(s.doc.activeElement,s.skip);
 assert.deepEqual(s.panels.map(p=>p.dataset.shown),['true','false','false']);
 s.advance(1999);assert.equal(s.screen.dataset.stage,'1');s.advance(2000);assert.equal(s.screen.dataset.stage,'2');
 s.advance(3799);assert.equal(s.screen.dataset.stage,'2');s.advance(3800);assert.equal(s.screen.dataset.stage,'3');
 assert.equal(s.nodes.wakeCause.textContent,'牛扒');assert.equal(s.nodes.wakeFoodArt.nodes[0],thumbnail);assert.equal(s.nodes.wakeDiner.src,'assets/wake-eat.webp');
 assert.equal(s.nodes.wakeTasteLine.nodes[0].textContent,'我真係好鍾意食');assert.equal(s.nodes.wakeReward.textContent,'幸福爆燈 · 獎勵 1 啖');
 s.advance(6599);assert.equal(s.screen.hidden,false);s.advance(6600);await p;restored(s);assert.equal(s.focus.restores,1);
});
test('hot and cold drinks use matching poses, names and verb; preview changes no gameplay state',async()=>{
 const s=setup();for(const food of [tea,lime]){const p=s.show({food,preview:true});assert.equal(s.nodes.wakeCause.textContent,food.name);assert.equal(s.nodes.wakeDiner.src,`assets/wake-${food.temperature}.webp`);assert.equal(s.nodes.wakeTasteLine.nodes[0].textContent,'我真係好鍾意飲');assert.equal(s.nodes.wakeReward.textContent,'幸福爆燈預覽');s.skip.dispatchEvent(new Event('click'));await p;restored(s);}
});
test('reduced motion shows a readable static triptych for 3400 ms',async()=>{
 const s=setup(true),p=s.show({food:tea});assert.equal(s.screen.style['--wake-duration'],'3400ms');assert.deepEqual(s.panels.map(p=>p.dataset.shown),['true','true','true']);s.advance(3399);assert.equal(s.screen.hidden,false);s.advance(3400);await p;restored(s);
});
test('Skip, Escape, background and pagehide each settle once and remove reveal timers',async()=>{
 const s=setup();for(const mode of ['click','Escape','hidden','pagehide']){
  s.doc.hidden=false;const p=s.show({food:steak});
  if(mode==='click'){s.skip.dispatchEvent(new Event('click'));s.skip.dispatchEvent(new Event('click'));}
  if(mode==='Escape'){const e=new Event('keydown',{cancelable:true});e.key='Escape';s.doc.dispatchEvent(e);assert.equal(e.defaultPrevented,true);}
  if(mode==='hidden'){s.doc.hidden=true;s.doc.dispatchEvent(new Event('visibilitychange'));}
  if(mode==='pagehide')s.win.dispatchEvent(new Event('pagehide'));
  await p;restored(s);
 }
 assert.equal(s.focus.restores,4);
});
test('a background tab does not take focus or lock board input',async()=>{const s=setup(false,true);await s.show({food:steak});assert.equal(s.screen.hidden,true);assert.equal(s.focus.restores,0);assert.equal(s.neighbor.inert,false);});
test('Tab remains on Skip and a detached previous target is not refocused',async()=>{const s=setup(),p=s.show({food:steak});const e=new Event('keydown',{cancelable:true});e.key='Tab';s.doc.dispatchEvent(e);assert.equal(e.defaultPrevented,true);assert.equal(s.doc.activeElement,s.skip);s.focus.isConnected=false;s.skip.dispatchEvent(new Event('click'));await p;assert.equal(s.focus.restores,0);assert.equal(s.neighbor.inert,false);});
