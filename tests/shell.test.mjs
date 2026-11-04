import test from 'node:test';
import assert from 'node:assert/strict';
import {PreviewFlow} from '../dist/shell.mjs';
const memory=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test('viewing home/help consumes no plays; double start and double finish are ignored',()=>{
 const f=new PreviewFlow(memory(),()=>Date.parse('2026-11-04T07:00:00Z'));
 assert.equal(f.screen,'home');assert.equal(f.remainingFree(),3);
 f.leaderboard();assert.equal(f.screen,'leaderboard');assert.equal(f.start(),false);f.back();
 assert.equal(f.start(),true);assert.equal(f.start(),false);assert.equal(f.remainingFree(),2);
 assert.equal(f.home(),false);assert.equal(f.leaderboard(),false);
 assert.equal(f.finish(),true);assert.equal(f.finish(),false);assert.equal(f.screen,'result');
 f.leaderboard();f.back();assert.equal(f.screen,'result');assert.equal(f.start(),true);assert.equal(f.remainingFree(),1);
});
test('preview quota resets at Hong Kong midnight and never locks or charges after three plays',()=>{
 let now=Date.parse('2026-11-04T15:59:59Z');const storage=memory(),f=new PreviewFlow(storage,()=>now);
 for(let i=0;i<4;i++){assert.equal(f.start(),true);f.finish();}
 assert.equal(f.remainingFree(),0);assert.equal(new PreviewFlow(storage,()=>now).remainingFree(),0);
 now+=1000;assert.equal(f.remainingFree(),3);f.home();f.start();assert.equal(f.remainingFree(),2);
});
test('corrupt or blocked storage cannot prevent starting, exiting and replaying',()=>{
 for(const storage of [{getItem:()=>'{bad',setItem:()=>{}},{getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}}]){
  const f=new PreviewFlow(storage);assert.equal(f.remainingFree(),3);f.start();assert.equal(f.remainingFree(),2);
  f.abandon();assert.equal(f.screen,'home');assert.equal(f.finish(),false);f.start();assert.equal(f.remainingFree(),1);
 }
});
test('two tabs share the latest preview count instead of overwriting it with an older count',()=>{
 const storage=memory(),now=()=>Date.parse('2026-11-04T07:00:00Z'),a=new PreviewFlow(storage,now),b=new PreviewFlow(storage,now);
 a.start();a.finish();a.start();a.finish();assert.equal(b.remainingFree(),1);
 b.start();assert.equal(new PreviewFlow(storage,now).remainingFree(),0);
});
test('an open homepage refreshes its free count automatically at Hong Kong midnight',async()=>{
 const old={document:globalThis.document,window:globalThis.window,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
 let now=Date.parse('2026-11-04T15:59:59Z'),sequence=0;const timers=new Map(),nodes=new Map();
 const node=()=>Object.assign(new EventTarget(),{textContent:'0',hidden:false,inert:false,dataset:{},style:{},focus(){},classList:{toggle(){}}});
 const doc=Object.assign(new EventTarget(),{getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},querySelector:()=>node()});
 globalThis.document=doc;globalThis.window=new EventTarget();globalThis.setTimeout=(fn,ms)=>{timers.set(++sequence,{fn,ms});return sequence;};globalThis.clearTimeout=id=>timers.delete(id);
 try{
  const {createShell}=await import('../dist/shell.mjs');
  const shell=createShell({storage:memory(),now:()=>now,onStart(){},onHelp(){},onExit(){},getBest:()=>0});
  shell.start();shell.finish();assert.equal(doc.getElementById('homeFreeCount').textContent,2);
  assert.equal(timers.size,1);const timer=[...timers.values()][0];assert.ok(timer.ms>=1000&&timer.ms<1200);
  now+=timer.ms;timers.clear();timer.fn();assert.equal(doc.getElementById('homeFreeCount').textContent,3);
 }finally{Object.assign(globalThis,old);}
});
