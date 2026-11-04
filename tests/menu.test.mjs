import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../dist/engine.mjs';

const rng=start=>()=>((start=(Math.imul(start,1664525)+1013904223)>>>0)/4294967296);
const families=['red','green','yellow','pink','neutral','brown'];

test('each round has six distinct color slots, one or two drinks and actual food/drink favorites',()=>{
  const seen=new Set();
  for(let seed=1;seed<=800;seed++){
    const s=engine.createRound(false,rng(Math.imul(seed,0x9e3779b1)));
    assert.equal(s.menu?.length,6,'round must carry its selected menu');
    assert.deepEqual(s.menu.map(f=>f.family),families);
    assert.equal(new Set(s.menu.map(f=>f.id)).size,6);
    const drinks=s.menu.filter(f=>f.category==='drink');assert.ok(drinks.length>=1&&drinks.length<=2);
    assert.deepEqual(s.favorites.map(i=>s.menu[i].category),['food','drink']);
    assert.ok(s.menu.every(f=>f.image || (Number.isInteger(f.artIndex)&&f.artIndex>=0&&f.artIndex<15)));
    assert.ok(['oyster','bao'].includes(s.menu[4].id));
    assert.equal(s.menu.filter(f=>['oyster','bao'].includes(f.id)).length,1);
    if(s.menu.some(f=>f.id==='coffee'))assert.equal(s.menu[0].id,'lobster');
    for(const f of s.menu)seen.add(f.id);
    assert.ok(s.board.every(c=>c>=0&&c<6));assert.ok(engine.findMove(s.board));
  }
  assert.deepEqual([...seen].sort(),['lobster','punch','cola','tempura','pudding','waffle','ramen','tea','lime','icecream','steak','turkey','chocolate','coffee','oyster','bao'].sort());
});

test('the teaching menu and food/drink pair are deterministic',()=>{
  for(const seed of [1,4,18]){
    const s=engine.createRound(true,rng(seed));
    assert.deepEqual(s.menu?.map(f=>f.id),['lobster','tea','tempura','icecream','oyster','steak']);
    assert.deepEqual(s.favorites,[0,1]);assert.ok(engine.planSwap(s.board,...engine.OPENING_MOVE));
  }
});

test('scoring, drops and shuffles cannot change the round menu or favorite identities',()=>{
  const random=rng(42),s=engine.createRound(false,random),menu=s.menu;
  assert.ok(menu,'selected menu required');const ids=menu.map(f=>f.id),fav=s.favorites.map(i=>menu[i].id);
  const [a,b]=engine.findMove(s.board,s.favorites),plan=engine.planSwap(s.board,a,b,s.favorites);
  s.board=engine.swapped(s.board,a,b);engine.scoreWave(s,plan);
  s.board=engine.dropWave(s.board,plan,random).board;s.board=engine.reshuffle(s.board,random);
  assert.strictEqual(s.menu,menu);assert.deepEqual(s.menu.map(f=>f.id),ids);assert.deepEqual(s.favorites.map(i=>s.menu[i].id),fav);
});
