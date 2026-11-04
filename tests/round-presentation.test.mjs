import assert from "node:assert/strict";
import test from "node:test";
import * as game from "../dist/engine.mjs";

const fresh=()=>game.createRound(true);
const wave=(hits,upgrades=[],effects=[])=>({hits,remove:hits,upgrades,effects});
const gold=(pos,targets)=>({kind:"gold",pos,targets});

test("a new 30-move round starts its two specified food counts, hand scores and earned moves at zero",()=>{
  for(const roll of [.01,.26,.51,.76,.99]){
    const r=game.createRound(false,()=>roll);
    assert.equal(r.moves,30);assert.equal(r.removals,1);
    assert.deepEqual(r.favorites.map(i=>r.menu[i].category),["food","drink"]);
    assert.deepEqual(r.favoriteCounts,[0,0]);assert.deepEqual([r.score,r.handScore,r.previousBite,r.bestHand,r.extraMoves],[0,0,0,0,0]);
  }
  const r=fresh();assert.deepEqual(r.favorites,[0,1]);assert.ok(game.planSwap(r.board,...game.OPENING_MOVE));
});

test("every food pays 10 or 30 at any cascade depth and each hand adds its waves together",()=>{
  const r=fresh();
  r.board.splice(0,5,0,1,game.lineCode(0,"row"),2,game.GOLD_ICON);
  const w=wave([0,1,2,3,4]);
  assert.deepEqual(game.scoreWave(r,w).cells,[{pos:0,points:30},{pos:1,points:30},{pos:2,points:30},{pos:3,points:10}]);
  assert.equal(game.scoreWave(r,w).points,100);
  assert.deepEqual([r.score,r.handScore,r.previousBite,r.bestHand,r.moves],[200,200,0,0,30]);
  game.finishBite(r);
  assert.deepEqual([r.previousBite,r.bestHand],[200,200]);
  assert.deepEqual(r.favoriteCounts,[4,2]);
  r.handScore=0;
  assert.equal(game.scoreWave(r,wave([3])).points,10);
  assert.deepEqual([r.score,r.handScore,r.previousBite,r.bestHand],[210,10,200,200]);
  game.finishBite(r);assert.deepEqual([r.previousBite,r.bestHand],[10,200]);
});

test("forming one or more gold icons grants one removal each, including a five of favourites, without awakening",()=>{
  const r=fresh();r.board.fill(0);
  const first=game.scoreWave(r,wave([0,1,2,3,4],[{pos:2,code:game.GOLD_ICON}]));
  assert.deepEqual(first.wakeFoods,[]);assert.equal(first.points,150);assert.equal(first.earned,1);
  assert.equal(first.cells.length,5);assert.equal(r.moves,30);assert.deepEqual(r.favoriteCounts,[5,0]);
  assert.equal(game.scoreWave(r,wave([0,1,2,3],[{pos:2,code:game.lineCode(0,"row")}])).earned,0);
  assert.equal(game.scoreWave(r,wave([0,1,2,3,4,5,6,7,8,9],[{pos:0,code:game.GOLD_ICON},{pos:8,code:game.GOLD_ICON}])).earned,2);
  assert.equal(r.removals,4);
});

test("only direct gold burns pay 60 and awaken; simultaneous arrow collateral keeps its own price",()=>{
  const r=fresh();r.board.splice(0,7,game.GOLD_ICON,0,game.lineCode(0,"row"),1,2,3,game.GOLD_ICON);
  const p=wave([0,1,2,3,4,5],[],[gold(0,[1,2]),{kind:"row",pos:2,targets:[1,2,3,4,5]}]);
  const a=game.scoreWave(r,p);
  assert.deepEqual(a.cells.map(c=>c.points),[60,60,30,10,10]);
  assert.deepEqual([a.points,r.moves,r.extraMoves,r.removals],[170,31,1,1]);
  assert.deepEqual(a.wakeFoods,[0]);assert.deepEqual(r.favoriteCounts,[2,1]);
  const ordinary=game.scoreWave(r,wave([0,4,1,3],[],[gold(0,[4]),{kind:"row",pos:4,targets:[4,1,3]}]));
  assert.deepEqual(ordinary.cells.map(c=>c.points),[10,30,30]);assert.deepEqual(ordinary.wakeFoods,[]);assert.equal(r.moves,31);
});

test("swapping two gold icons clears each food once and grants three bites total",()=>{
  const r=fresh();r.board=Array.from({length:49},(_,i)=>(Math.floor(i/7)+i%7)%6);
  r.board[0]=game.GOLD_ICON;r.board[1]=game.GOLD_ICON;
  const before=r.board.slice(),p=game.planSwap(before,0,1,r.favorites);
  r.board=game.swapped(before,0,1);r.moves=6;
  const a=game.scoreWave(r,p);
  assert.equal(a.cells.length,47);assert.equal(new Set(a.cells.map(c=>c.pos)).size,47);
  for(const c of a.cells)assert.equal(c.points,r.favorites.includes(game.foodType(r.board[c.pos]))?60:10);
  assert.deepEqual(a.wakeFoods,[0,1]);assert.equal(a.bonusMoves,3);
  assert.equal(r.moves,9);assert.equal(r.extraMoves,3);
  const hint=game.suggestMove(before,r.favorites);assert.equal(hint.doubleGold,true);assert.equal(hint.bonusMoves,3);
});

test("double gold still grants three bites when no specified food is on the board",()=>{
  const r=fresh();r.board=Array(49).fill(2);r.board[0]=game.GOLD_ICON;r.board[1]=game.GOLD_ICON;r.moves=0;
  const p=game.planSwap(r.board,0,1);r.board=game.swapped(r.board,0,1);
  const a=game.scoreWave(r,p);assert.equal(a.points,470);assert.deepEqual(a.wakeFoods,[]);
  assert.equal(a.bonusMoves,3);assert.equal(r.moves,3);assert.equal(r.extraMoves,3);
});

test("two golds caught by a row arrow grant one bite, not the direct-swap reward",()=>{
  const r=fresh();r.board=Array(49).fill(0);
  r.board[0]=game.lineCode(0,"row");r.board[1]=game.GOLD_ICON;r.board[2]=game.GOLD_ICON;
  const p=game.toolWave(r.board,[0]),a=game.scoreWave(r,p);
  assert.equal(p.effects.filter(e=>e.kind==="gold").length,2);
  assert.equal(a.bonusMoves,1);assert.equal(r.moves,31);assert.equal(r.extraMoves,1);
});

test("ordinary removal consumes one charge, pays for that food and costs no bite",()=>{
  const r=fresh();r.board[6]=2;
  for(const pos of [-1,49,null,1.1])assert.equal(game.takeRemoval(r,pos),null);
  const p=game.takeRemoval(r,6);assert.deepEqual(p,wave([6]));
  const a=game.scoreWave(r,p);assert.equal(a.points,10);assert.deepEqual(a.cells,[{pos:6,points:10}]);assert.deepEqual(a.wakeFoods,[]);
  assert.equal(r.removals,0);assert.equal(r.moves,30);assert.equal(game.takeRemoval(r,0),null);
  r.removals=2;r.moves=0;assert.equal(game.takeRemoval(r,3),null);assert.equal(r.removals,2);
});

for(const [direction,targets] of [
  ["row",[21,22,23,24,25,26,27]],
  ["column",[3,10,17,24,31,38,45]]
])test(`removing a ${direction} arrow fires its entire line without spending a bite`,()=>{
  const r=fresh();r.board=Array.from({length:49},(_,i)=>(Math.floor(i/7)+i%7)%6);
  r.board[24]=game.lineCode(2,direction);
  const before=r.board.slice(),p=game.takeRemoval(r,24);
  assert.deepEqual([...p.remove].sort((a,b)=>a-b),targets);
  assert.deepEqual(p.effects,[{kind:direction,pos:24,targets}]);
  assert.deepEqual(r.board,before,"planning must leave food available for scoring and animation");
  assert.equal(r.removals,0);assert.equal(r.moves,30);
  assert.equal(game.takeRemoval(r,24),null);
});

test("a removed arrow triggers a crossing arrow and counts the intersection once",()=>{
  const r=fresh();r.board=Array(49).fill(2);
  r.board[23]=game.lineCode(2,"row");r.board[26]=game.lineCode(2,"column");
  const p=game.takeRemoval(r,23),a=game.scoreWave(r,p);
  assert.deepEqual([...p.remove].sort((a,b)=>a-b),[5,12,19,21,22,23,24,25,26,27,33,40,47]);
  assert.equal(a.cells.length,13);assert.equal(a.points,130);
  assert.equal(r.moves,30);assert.equal(r.removals,0);
});

test("removing gold burns the most numerous food even when it is not a favorite",()=>{
  const r=fresh();r.board=Array(49).fill(2);r.board.fill(0,0,9);r.board[0]=game.GOLD_ICON;
  const p=game.takeRemoval(r,0),a=game.scoreWave(r,p);
  assert.equal(p.effects.length,1);assert.equal(p.effects[0].kind,"gold");
  assert.equal(p.effects[0].targets.length,40);
  assert.equal(p.effects[0].targets[0],9);assert.equal(p.effects[0].targets.at(-1),48);
  assert.equal(a.points,400);assert.equal(a.cells.length,40);assert.ok(a.cells.every(c=>c.points===10));
  assert.deepEqual(a.wakeFoods,[]);assert.equal(r.moves,30);assert.equal(r.removals,0);
});

test("removing gold that burns a favorite pays 60 per food and grants exactly one bite",()=>{
  const r=fresh();r.board=Array(49).fill(0);r.board[24]=game.GOLD_ICON;
  const p=game.takeRemoval(r,24),a=game.scoreWave(r,p);
  assert.equal(p.remove.length,49);assert.equal(a.cells.length,48);
  assert.ok(a.cells.every(c=>c.points===60));assert.ok(!a.cells.some(c=>c.pos===24));
  assert.equal(a.points,2880);assert.deepEqual(a.wakeFoods,[0]);assert.deepEqual(r.favoriteCounts,[48,0]);
  assert.equal(r.moves,31);assert.equal(r.extraMoves,1);assert.equal(r.removals,0);
});
