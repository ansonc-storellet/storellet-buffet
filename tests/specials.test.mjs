import assert from "node:assert/strict";
import test from "node:test";
import { GOLD_ICON, scoreWave, createRound, dropWave, findMove, kindOf, lineCode,
  matches, naturalWave, planSwap, reshuffle, swapped, toolWave, suggestMove } from "../dist/engine.mjs";

const latinBoard = () => Array.from({length:49}, (_,i) => (Math.floor(i/7) + i%7) % 6);
function paint(board, positions, code) {
  for (const pos of positions) board[pos] = code;
  return board;
}

test("a four-match leaves a directional food that follows gravity", () => {
  const board = paint(latinBoard(), [22,23,24,25], 5);
  const wave = naturalWave(board, [24]);
  assert.deepEqual(wave.upgrades, [{pos:24, code:lineCode(5,"row"), cells:[22,23,24,25]}]);
  assert.deepEqual(wave.remove.sort((a,b)=>a-b), [22,23,25]);
  const drop = dropWave(board,wave,()=>.36);
  const end = drop.fromRow.findIndex((row,i)=>i%7===3 && row===3);
  assert.equal(drop.board[end], lineCode(5,"row"));

  const column = paint(latinBoard(), [10,17,24,31], 1);
  assert.equal(kindOf(naturalWave(column,[17]).upgrades[0].code), "column");
});

test("five in a straight line or two intersecting runs make one gold icon", () => {
  for (const [cells,type,anchor] of [
    [[22,23,24,25,26],4,25],
    [[16,23,29,30,31],4,30]
  ]) {
    const fixture = paint(latinBoard(),cells,type);
    if(anchor===30) fixture[28]=3; // Cap the horizontal arm at exactly three pieces.
    const wave = naturalWave(fixture, [anchor]);
    assert.deepEqual(wave.upgrades, [{pos:anchor,code:GOLD_ICON,cells}]);
    assert.ok(!wave.remove.includes(anchor));
  }
  assert.equal(naturalWave(paint(latinBoard(),[8,9,15,16],0)).hits.length, 0);
});

test("line effects trigger one another without double-counting intersections", () => {
  const board = latinBoard();
  board[23]=lineCode(3,"row");
  board[26]=lineCode(3,"column");
  const wave = toolWave(board,[23]);
  assert.deepEqual(wave.hits.sort((a,b)=>a-b),[5,12,19,21,22,23,24,25,26,27,33,40,47]);
});

test("a gold icon swap takes the chosen food, including its directional tiles", () => {
  const board=latinBoard();
  board[24]=GOLD_ICON;
  board[12]=lineCode(board[25],"column");
  const after=swapped(board,24,25), wave=planSwap(board,24,25);
  assert.ok(wave.hits.includes(25));
  const glow=wave.effects.find(effect=>effect.kind==="gold");
  const targets=after.flatMap((code,i)=>code!==GOLD_ICON && code%6===board[25]?[i]:[]);
  assert.deepEqual(glow.targets,targets,"the icon only links visually to its chosen colour");
  assert.ok(wave.effects.some(effect=>effect.kind==="column" && effect.pos===12));
  after.forEach((code,i)=>{if(code===board[25])assert.ok(wave.hits.includes(i));});
  board[25]=GOLD_ICON;
  assert.equal(planSwap(board,24,25).hits.length,49);
});

test("a directional food credits its food colour and the gold icon pays zero", () => {
  const shift=createRound(true);
  shift.board[4]=lineCode(1,"row");
  shift.board[5]=GOLD_ICON;
  const scoring=scoreWave(shift,{hits:[4,5],upgrades:[],effects:[]});
  assert.deepEqual(scoring.cells,[{pos:4,points:30}]);assert.equal(scoring.points,30);
});

test("the no-moves shuffle retains earned tiles even if random attempts repeat", () => {
  const before=latinBoard();
  before[8]=lineCode(before[8],"column");
  assert.equal(findMove(before),null);
  const after=reshuffle(before,()=>.99999);
  assert.deepEqual([...after].sort(),[...before].sort());
  assert.deepEqual(matches(after),[]);
  assert.ok(findMove(after));
});


test("gold and a striped favourite arm all and only that food, starting at the original arrow after swapping",()=>{
  const before=latinBoard(),goldPos=17,partner=18,type=before[partner];
  before[goldPos]=GOLD_ICON;before[partner]=lineCode(type,"column");
  const after=swapped(before,goldPos,partner),fav=[type,(type+1)%6],p=planSwap(before,goldPos,partner,fav);
  const targets=after.flatMap((code,i)=>code!==GOLD_ICON&&code%6===type?[i]:[]);
  const distance=i=>Math.abs(i%7-goldPos%7)+Math.abs(Math.floor(i/7)-Math.floor(goldPos/7));
  targets.sort((a,b)=>distance(a)-distance(b)||a-b);
  assert.equal(p.conversion.origin,goldPos);assert.equal(p.conversion.goldPos,partner);
  assert.equal(p.conversion.type,type);assert.deepEqual(p.conversion.stripes.map(x=>x.pos),targets);
  assert.deepEqual(p.conversion.stripes.map(x=>x.kind),targets.map((_,i)=>i%2?"row":"column"));
  const far=Math.max(...targets.map(distance));
  assert.deepEqual(p.conversion.stripes.map(x=>x.batch),targets.map(i=>i===goldPos?0:distance(i)<=Math.ceil(far/2)?1:2));
  for(const arrow of p.conversion.stripes){
    const effects=p.effects.filter(e=>e.pos===arrow.pos);assert.equal(effects.length,1);assert.equal(effects[0].kind,arrow.kind);
    const line=after.flatMap((_,i)=>(arrow.kind==="row"?Math.floor(i/7)===Math.floor(arrow.pos/7):i%7===arrow.pos%7)?[i]:[]);
    assert.deepEqual(effects[0].targets,line);assert.ok(p.remove.includes(arrow.pos));
  }
  assert.equal(new Set(p.hits).size,p.hits.length);
  const r=createRound(true);r.favorites=fav;r.board=after;const a=scoreWave(r,p);
  assert.deepEqual(a.wakeFoods,[type]);assert.equal(r.extraMoves,1);assert.equal(r.removals,1);
  for(const c of a.cells)assert.equal(c.points,targets.includes(c.pos)?60:after[c.pos]%6===fav[1]?30:10);
  assert.deepEqual(planSwap(before,partner,goldPos,fav).conversion,p.conversion);
});

test("every food can convert with gold, while a nonfavorite conversion keeps normal prices and earns no awakening",()=>{
  for(const type of [0,1,2,3,4,5])for(const kind of ["row","column"]){
    const b=latinBoard();b[24]=GOLD_ICON;b[25]=lineCode(type,kind);
    const favorites=[(type+1)%6,(type+2)%6],after=swapped(b,24,25);
    const p=planSwap(b,24,25,favorites);
    assert.ok(p.conversion,"nonfavorite food must also convert");
    const targets=after.flatMap((code,pos)=>code!==GOLD_ICON&&code%6===type?[pos]:[]);
    assert.deepEqual(p.conversion.stripes.map(s=>s.pos).sort((a,b)=>a-b),targets);
    assert.deepEqual(planSwap(b,24,25).conversion,p.conversion,"conversion does not depend on scoring favorites");
    const round=createRound(true);round.board=after;round.favorites=favorites;
    const paid=scoreWave(round,p);
    assert.deepEqual(paid.wakeFoods,[]);assert.equal(round.extraMoves,0);assert.equal(round.moves,30);
    assert.equal(new Set(paid.cells.map(c=>c.pos)).size,paid.cells.length);
    for(const cell of paid.cells)assert.equal(cell.points,favorites.includes(after[cell.pos]%6)?30:10);
    assert.equal(p.conversion.stripes.length,p.effects.filter(e=>targets.includes(e.pos)).length);
  }
});

test("plain favourites, two golds and indirect gold hits retain their ordinary behaviour",()=>{
  const b=latinBoard();b[24]=GOLD_ICON;const type=b[25],f=[type,(type+1)%6];
  assert.equal(planSwap(b,24,25,f).conversion,undefined);
  b[25]=lineCode(type,"row");
  assert.equal(toolWave(b,[24]).conversion,undefined);
  b[25]=GOLD_ICON;assert.equal(planSwap(b,24,25,f).conversion,undefined);
});

test("a converted food cannot leave a newly formed special behind in the same activation",()=>{
  const b=latinBoard();const t=0;b[23]=GOLD_ICON;b[30]=lineCode(t,"row");
  for(const i of [21,22,24,25])b[i]=t;
  const p=planSwap(b,23,30,[0,1]);
  for(const pos of [21,22,23,24,25])assert.ok(p.remove.includes(pos));
  assert.equal(p.upgrades.some(u=>p.conversion.stripes.some(a=>a.pos===u.pos)),false);
});

test("the hint compares the visible first-wave points, reports the award and never changes the board",()=>{
  const b=latinBoard();b[24]=GOLD_ICON;const t=b[25];b[25]=lineCode(t,"row");
  const fav=[t,(t+1)%6],copy=b.slice(),hint=suggestMove(b,fav),candidates=[];
  for(let a=0;a<b.length;a++)for(const z of [a+1,a+7]){
    const p=planSwap(b,a,z,fav);if(!p)continue;
    const r=createRound(true);r.board=swapped(b,a,z);r.favorites=fav;const award=scoreWave(r,p);
    candidates.push({points:award.points,awake:Number(award.wakeFoods.length>0),gold:award.earned,
      stripes:p.upgrades.filter(u=>u.code!==GOLD_ICON).length});
  }
  candidates.sort((a,b)=>b.points-a.points||b.awake-a.awake||b.gold-a.gold||b.stripes-a.stripes);
  assert.deepEqual([hint.points,Number(hint.awakens),hint.gold,hint.arrows],
    [candidates[0].points,candidates[0].awake,candidates[0].gold,candidates[0].stripes]);
  assert.equal(hint.conversion,true);assert.deepEqual(findMove(b,fav),hint.pair);assert.deepEqual(b,copy);
  assert.equal(suggestMove(latinBoard(),fav),null);
});
