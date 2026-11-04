import { MENU, drawMenu } from './menu.mjs?v=17';
export { MENU };
export const SIZE = 7;
export const TURNS = 30;
export const FAVORITE_GOLD_POINTS = 60;
// The first swap clears lobster on row 5, dropping tea into a vertical match.
export const OPENING_MOVE = [32, 31];
const OPENING = [
  4, 1, 3, 5, 1, 2, 4,
  2, 0, 5, 2, 4, 2, 1,
  4, 3, 5, 2, 3, 1, 2,
  1, 3, 1, 4, 5, 5, 3,
  5, 0, 0, 3, 0, 2, 5,
  1, 0, 1, 5, 2, 5, 5,
  0, 3, 1, 3, 3, 4, 1
];
export function openingBoard() { return OPENING.slice(); }
export function adjacent(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= SIZE * SIZE || b >= SIZE * SIZE) return false;
  return Math.abs(a % SIZE - b % SIZE) + Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)) === 1;
}
export function swapped(board, a, b) {
  const copy = board.slice();
  [copy[a], copy[b]] = [copy[b], copy[a]];
  return copy;
}
const FOOD_COUNT = MENU.length;
export const GOLD_ICON = FOOD_COUNT * 3;
export const foodType = code => code === GOLD_ICON ? -1 : code % FOOD_COUNT;
export function kindOf(code) {
  if (code === GOLD_ICON) return "gold";
  if (code >= 2*FOOD_COUNT) return "column";
  return code >= FOOD_COUNT ? "row" : "food";
}
export const lineCode = (type, direction) => type + (direction === "row" ? FOOD_COUNT : 2*FOOD_COUNT);

function matchRuns(board) {
  const runs = [];
  for (const direction of ["row","column"]) {
    const step = direction === "row" ? 1 : SIZE;
    for (let line=0; line<SIZE; line++) {
      const first = direction === "row" ? line*SIZE : line;
      let start=0;
      while (start<SIZE) {
        const type=foodType(board[first+start*step]);
        let end=start+1;
        while(type>=0 && end<SIZE && foodType(board[first+end*step])===type) end++;
        if(end-start>=3) {
          const positions=[];
          for(let j=start;j<end;j++) positions.push(first+j*step);
          runs.push({direction,positions,type});
        }
        start=end;
      }
    }
  }
  return runs;
}
export function matches(board) {
  return [...new Set(matchRuns(board).flatMap(run=>run.positions))];
}
function matchedGroups(board, preferred) {
  const groups=[];
  for (const run of matchRuns(board)) {
    const cells=new Set(run.positions);
    // Only overlapping horizontal and vertical runs make a single T/L match.
    for(let i=groups.length-1;i>=0;i--) {
      if(!run.positions.some(pos=>groups[i].cells.has(pos))) continue;
      for(const pos of groups[i].cells) cells.add(pos);
      groups.splice(i,1);
    }
    groups.push({cells,type:run.type,direction:run.direction});
  }
  const initial=[], upgrades=[];
  for (const {cells,type,direction} of groups) {
    const list=[...cells].sort((a,b)=>a-b);initial.push(...list);
    if(list.length<4) continue;
    const pos=preferred.find(p=>cells.has(p)) ?? list[Math.floor(list.length/2)];
    upgrades.push({pos,code:list.length>=5 ? GOLD_ICON : lineCode(type,direction),cells:list});
  }
  return {initial,upgrades};
}
function mostFrequentFood(board) {
  const counts=Array(FOOD_COUNT).fill(0);
  for(const code of board){const type=foodType(code);if(type>=0)counts[type]++;}
  return counts.indexOf(Math.max(...counts));
}
// Conversion positions refer to the exchanged board. Equal-distance targets are ordered by grid index.
function buildConversion(board,goldPos,origin) {
  const type=foodType(board[origin]),first=kindOf(board[origin]);
  const distance=pos=>Math.abs(pos%SIZE-origin%SIZE)+Math.abs(Math.floor(pos/SIZE)-Math.floor(origin/SIZE));
  const targets=board.flatMap((code,pos)=>foodType(code)===type?[pos]:[]);
  targets.sort((a,b)=>distance(a)-distance(b)||a-b);
  const near=Math.ceil(distance(targets[targets.length-1])/2);
  const other=first==="row"?"column":"row";
  const stripes=targets.map((pos,i)=>({pos,kind:i%2===0?first:other,batch:i===0?0:distance(pos)<=near?1:2}));
  return {goldPos,origin,type,stripes};
}
function expandWave(board, initial, upgrades, goldTargets, conversion) {
  const all=new Set(initial), queue=[...all], effects=[];
  const converted=conversion ? new Map(conversion.stripes.map(arrow=>[arrow.pos,arrow.kind])) : null;
  function hit(pos) {
    if(!all.has(pos)){all.add(pos);queue.push(pos);}
  }
  for(let i=0;i<queue.length;i++){
    const pos=queue[i],kind=converted?.get(pos) ?? kindOf(board[pos]);
    if(kind==="food") continue;
    const targets = [];
    if (kind === "gold") {
      const colour = goldTargets?.get(pos) ?? mostFrequentFood(board);
      board.forEach((code, index) => {
        if (colour === "all" || foodType(code) === colour) targets.push(index);
      });
    } else {
      const first = kind === "row" ? Math.floor(pos / SIZE) * SIZE : pos % SIZE;
      const step = kind === "row" ? 1 : SIZE;
      for (let n = 0; n < SIZE; n++) targets.push(first + n * step);
    }
    effects.push({kind, pos, targets});
    targets.forEach(hit);
  }
  const survivors=converted ? upgrades.filter(up=>!converted.has(up.pos)) : upgrades;
  const protectedCells=new Set(survivors.map(up=>up.pos));
  const plan={hits:queue,remove:queue.filter(pos=>!protectedCells.has(pos)),upgrades:survivors,effects};
  if(conversion)plan.conversion=conversion;
  return plan;
}
export function naturalWave(board, preferred=[]) {
  const {initial,upgrades}=matchedGroups(board,preferred);
  return expandWave(board,initial,upgrades);
}
export function toolWave(board, hits) {
  return expandWave(board,hits,[]);
}
export function planSwap(board,a,b,favorites=null) {
  if(!adjacent(a,b)) return null;
  const hasGold=board[a]===GOLD_ICON || board[b]===GOLD_ICON;
  if(!hasGold && foodType(board[a])===foodType(board[b])) return null;
  const after=swapped(board,a,b);
  const {initial,upgrades}=matchedGroups(after,[b,a]);
  if(!hasGold) return initial.length ? expandWave(after,initial,upgrades) : null;
  const goldTargets=new Map();
  for(const [pos,other] of [[a,b],[b,a]]) {
    if(after[pos]===GOLD_ICON)goldTargets.set(pos,after[other]===GOLD_ICON?"all":foodType(after[other]));
  }
  const goldPos=after[a]===GOLD_ICON?a:b, other=goldPos===a?b:a;
  const kind=kindOf(after[other]);
  const conversion=(kind==="row" || kind==="column")
    ? buildConversion(after,goldPos,other) : undefined;
  const plan=expandWave(after,[...initial,a,b],upgrades,goldTargets,conversion);
  if(after[a]===GOLD_ICON && after[b]===GOLD_ICON)plan.doubleGold=true;
  return plan;
}
export function swapHits(board,a,b,favorites=null) {
  return planSwap(board,a,b,favorites)?.hits ?? [];
}
export function dropWave(board, plan, random=Math.random) {
  const prepared=board.slice();
  for(const {pos,code} of plan.upgrades) prepared[pos]=code;
  return dropTiles(prepared,plan.remove,random);
}
function compareMoves(a,b) {
  return a.points-b.points || Number(a.awakens)-Number(b.awakens) || a.gold-b.gold || a.arrows-b.arrows;
}
export function suggestMove(board,favorites=null) {
  let best=null;
  for(let i=0;i<board.length;i++)for(const j of [i+1,i+SIZE]){
    const plan=planSwap(board,i,j,favorites);
    if(!plan)continue;
    if(!favorites)return {pair:[i,j]};
    const cells=foodAwards(swapped(board,i,j),plan,favorites);
    const gold=plan.upgrades.filter(up=>up.code===GOLD_ICON).length;
    const awakens=cells.some(c=>c.points===FAVORITE_GOLD_POINTS);
    const option={
      pair:[i,j],points:cells.reduce((sum,c)=>sum+c.points,0),
      awakens,gold,arrows:plan.upgrades.length-gold,
      doubleGold:Boolean(plan.doubleGold),bonusMoves:plan.doubleGold?3:awakens?1:0,
      conversion:Boolean(plan.conversion),firesArrow:plan.effects.some(e=>e.kind==="row"||e.kind==="column")
    };
    if(!best||compareMoves(option,best)>0)best=option;
  }
  return best;
}
export function findMove(board,favorites=null) {
  return suggestMove(board,favorites)?.pair ?? null;
}
export function freshBoard(random = Math.random) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const board = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      const options = MENU.map((_, type) => type).filter(type =>
        !(i % SIZE >= 2 && board[i-1] === type && board[i-2] === type) &&
        !(i >= SIZE*2 && board[i-SIZE] === type && board[i-SIZE*2] === type));
      board.push(options[Math.floor(random() * options.length)]);
    }
    if (findMove(board)) return board;
  }
  return openingBoard();
}
export function reshuffle(board, random = Math.random) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const copy = board.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    if (!matches(copy).length && findMove(copy)) return copy;
  }
  // On a dead board, search for a stable rearrangement before replacing any tile.
  for(let a=0;a<board.length;a++)for(let b=a+1;b<board.length;b++){
    if(foodType(board[a])===foodType(board[b]))continue;
    const candidate=swapped(board,a,b);
    if(!matches(candidate).length && findMove(candidate))return candidate;
  }
  const next=board.slice(), ordinary=board.findIndex(code=>kindOf(code)==="food");
  if(!matches(next).length){next[Math.max(0,ordinary)]=GOLD_ICON;return next;}
  return freshBoard(random);
}
export function dropTiles(board, hits, random = Math.random) {
  const cleared = new Set(hits), next = new Array(board.length), fromRow = new Array(board.length);
  for (let col = 0; col < SIZE; col++) {
    let dest = SIZE - 1;
    for (let row = SIZE - 1; row >= 0; row--) {
      if (cleared.has(row * SIZE + col)) continue;
      next[dest * SIZE + col] = board[row * SIZE + col];
      fromRow[dest * SIZE + col] = row;
      dest--;
    }
    const missing = dest + 1;
    for (let row = 0; row < missing; row++) {
      next[row * SIZE + col] = Math.floor(random() * MENU.length);
      fromRow[row * SIZE + col] = row - missing;
    }
  }
  return { board: next, fromRow };
}

export function createRound(teaching = false, random = Math.random) {
  // The teaching board demonstrates the same two menu items as the first ticket.
  const menu=teaching ? MENU : drawMenu(random);
  const categories=["food","drink"].map(category=>
    menu.flatMap((food,i)=>food.category===category?[i]:[]));
  const favorites = teaching ? [0,1] : categories.map(group => group[Math.floor(random()*group.length)]);
  return {
    board:teaching ? openingBoard() : freshBoard(random), menu, favorites, moves:TURNS,
    score:0, handScore:0, previousBite:0, bestHand:0, favoriteCounts:[0,0], extraMoves:0,
    removals:1, shuffle:1, guided:teaching, busy:false, over:false
  };
}

export function roundFinished(state) { return state.moves === 0; }

// One charge activates the selected tile, including its special effect and any chain reactions.
// A directly activated gold icon uses the same most-numerous-food rule as an indirect gold hit.
export function takeRemoval(state,pos) {
  if (!Number.isInteger(pos) || pos<0 || pos>=state.board.length ||
      state.moves<=0 || state.removals<=0 || state.busy || state.over) return null;
  state.removals--;
  return toolWave(state.board,[pos]);
}

// The icon's own target list is distinct from arrow collateral in the same explosion.
function foodAwards(board,plan,favorites) {
  const burned=new Set();
  for(const effect of plan.effects){
    if(effect.kind==="gold") for(const pos of effect.targets)burned.add(pos);
  }
  const cells=[];
  for(const pos of plan.hits){
    const type=foodType(board[pos]);
    if(type<0)continue;
    let points=10;
    if(favorites.includes(type))points=burned.has(pos)?FAVORITE_GOLD_POINTS:30;
    cells.push({pos,points});
  }
  return cells;
}

// hits are unique across a wave, including the original food transformed into a special.
export function scoreWave(state,plan) {
  const cells=foodAwards(state.board,plan,state.favorites);
  const awake=new Set();
  let points=0;
  for(const cell of cells){
    points+=cell.points;
    if(cell.points===10)continue;
    const type=foodType(state.board[cell.pos]);
    state.favoriteCounts[state.favorites.indexOf(type)]++;
    if(cell.points===FAVORITE_GOLD_POINTS)awake.add(type);
  }
  const wakeFoods=state.favorites.filter(type=>awake.has(type));
  const earned=plan.upgrades.filter(up=>up.code===GOLD_ICON).length;
  state.removals+=earned;
  const bonusMoves=plan.doubleGold?3:wakeFoods.length?1:0;
  state.extraMoves+=bonusMoves;state.moves+=bonusMoves;
  state.score+=points;state.handScore+=points;
  return {points,cells,earned,wakeFoods,bonusMoves};
}


// Commit only after all drops following one exchange or one free removal have finished.
export function finishBite(state) {
  state.previousBite=state.handScore;
  state.bestHand=Math.max(state.bestHand,state.previousBite);
}
