import {
  SIZE, OPENING_MOVE, GOLD_ICON, adjacent, swapped, findMove, suggestMove, reshuffle, createRound,
  roundFinished, scoreWave, finishBite, takeRemoval, foodType, kindOf, planSwap, naturalWave, dropWave
} from "./engine.mjs?v=20";
import { TileLayer, foodThumbnail } from "./tile-layer.mjs?v=20";
import { createAwakening } from "./awakening.mjs?v=20";
import { createShell } from "./shell.mjs?v=20";

const $ = id => document.getElementById(id);
const boardEl=$("board"), help=$("helpDialog");
const showAwakening=createAwakening($("awakening"),$("wakeSkip"));
const showDoubleGold=createAwakening($("doubleGold"),$("goldSkip"),{mode:"double-gold"});
const bestKey="storellet.cafe-match.score30.flat.v2.best";
const guideKey="storellet.cafe-match.phase1.guided";
const cells=[], arrows=[];
const format=n=>n.toLocaleString("en-US");
function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
function save(key,value) { try { localStorage.setItem(key,String(value)); } catch { /* The current tab still keeps the record. */ } }
function storedBest() {
  const value=Number(read(bestKey));
  return Number.isSafeInteger(value) && value>0 ? value : 0;
}
let shell;
let best=storedBest(), state, selected=null, focusCell=0, marked=[], pointer=null, removing=false;
function tip(message){$("tip").textContent=message;}
function announce(message){$("live").textContent=message;}
for(let i=0;i<SIZE*SIZE;i++){
  const cell=document.createElement("button"), arrow=document.createElement("span");
  cell.type="button";cell.className="cell";cell.dataset.pos=String(i);cell.tabIndex=i===0?0:-1;
  arrow.className="hint-arrow";arrow.setAttribute("aria-hidden","true");
  cell.append(arrow);boardEl.append(cell);cells.push(cell);arrows.push(arrow);
}
const tiles=new TileLayer(boardEl);
// Touch and restored dialog focus must not look like a selected food.
// Keep an explicit focus ring for keyboard navigation.
document.addEventListener("pointerdown",()=>boardEl.classList.remove("keyboard-input"),{capture:true});
document.addEventListener("keydown",event=>{
  if(["Tab","ArrowLeft","ArrowRight","ArrowUp","ArrowDown","Enter"," "].includes(event.key))
    boardEl.classList.add("keyboard-input");
},{capture:true});
function paintBoard() {
  state.board.forEach((code,i)=>{
    const cell=cells[i];
    const kind=kindOf(code), food=state.menu[foodType(code)];
    if(cell.dataset.code===String(code)&&cell.dataset.food===(food?.id||"gold-app-icon"))return;
    const title=kind==="gold"?"金色 Storellet Icon":food.name+(kind==="row"?"，橫掃箭嘴":kind==="column"?"，直掃箭嘴":"");
    cell.dataset.code=String(code);
    cell.dataset.food=food?.id || "gold-app-icon";
    cell.setAttribute("aria-label","第"+(Math.floor(i/SIZE)+1)+"行第"+(i%SIZE+1)+"格，"+title);
  });
}
function paintStats() {
  $("score").textContent=format(state.score);$("best").textContent=best?format(best):"—";
  $("handScore").textContent="+"+format(state.previousBite);
  $("bestHand").textContent="+"+format(state.bestHand);
  for(const [i,type] of state.favorites.entries()){
    const item=$("favCount"+i);
    if(item)item.textContent="已消 "+format(state.favoriteCounts[i])+" "+state.menu[type].unit;
  }
  $("moves").textContent=state.moves;$("movesBox").classList.toggle("low",state.moves<=5);
  $("removeCount").textContent=state.removals;
  const remove=$("removeButton");
  remove.setAttribute("aria-label","移除一格，剩餘 "+state.removals+" 次"+(removing?"，再撳取消":""));
  remove.setAttribute("aria-pressed",String(removing));
  remove.classList.toggle("spent",!state.removals);
}
function paintFavorites() {
  $("favorites").replaceChildren(...state.favorites.map((type,i)=>{
    const wrap=document.createElement("span"), info=document.createElement("span");
    const name=document.createElement("span"), count=document.createElement("span");
    wrap.className="fav-choice";info.className="fav-info";name.className="fav-name";count.className="fav-count";
    name.textContent=state.menu[type].shortName;name.title=state.menu[type].name;count.id="favCount"+i;
    info.append(name,count);wrap.append(foodThumbnail(type,state.menu),info);
    return wrap;
  }));
}
function paintMenu(){
  $("roundMenu").replaceChildren(...state.menu.map((food,type)=>{
    const item=document.createElement("li"),name=document.createElement("span");
    item.dataset.food=food.id;name.textContent=food.shortName;item.title=food.name;
    item.append(foodThumbnail(type,state.menu),name);return item;
  }));
}
function setBusy(flag) {
  state.busy=flag;
  for(const id of ["hintButton","helpButton"])$(id).disabled=flag || state.over;
  $("removeButton").disabled=flag || state.over || !state.removals;
  $("shuffleInHelp").disabled=flag || state.over || !state.shuffle;
  $("shuffleInHelp").textContent=state.shuffle?"洗牌一次（唔扣啖數）":"本局已洗牌";
  boardEl.setAttribute("aria-busy",String(flag));
}
function interactive(){return shell?.isPlaying() && !pointer && !state.busy && !state.over && !document.querySelector("dialog[open]");}
function clearMarks() {
  for (const i of marked) {
    cells[i].classList.remove("marked", "guide-from"); arrows[i].textContent="";
  }
  marked = [];
}
function markMove(pair) {
  clearMarks();
  if (!pair) return;
  marked = [...pair]; for (const i of marked) cells[i].classList.add("marked");
  const delta = pair[1]-pair[0];
  cells[pair[0]].classList.add("guide-from");
  arrows[pair[0]].textContent = delta === 1 ? "→" : delta === -1 ? "←" : delta > 0 ? "↓" : "↑";
}
function setSelection(pos) {
  if (selected !== null) { cells[selected].classList.remove("selected"); cells[selected].setAttribute("aria-pressed", "false"); }
  selected = pos;
  if (pos !== null) { cells[pos].classList.add("selected"); cells[pos].setAttribute("aria-pressed", "true"); }
}
function setFocus(pos, moveFocus = false) {
  cells[focusCell].tabIndex = -1; focusCell = pos; cells[pos].tabIndex = 0;
  if (moveFocus) cells[pos].focus({ preventScroll:true });
}
function setRemoving(flag) {
  removing=flag;boardEl.classList.toggle("removing",flag);
  boardEl.setAttribute("aria-label",flag?"移除模式，點想移除嘅一格":"七乘七食物棋盤，用手指掃動或點選相鄰兩格");
  paintStats();
}
function newRound(teaching=false){
  if(boardEl.contains(document.activeElement))document.activeElement.blur();
  setSelection(null);clearMarks();pointer=null;best=Math.max(best,storedBest());
  state=createRound(teaching);
  paintFavorites();paintMenu();setRemoving(false);$("handScore").parentElement.classList.remove("score-settled");tiles.reset(state.board,state.menu);paintBoard();setFocus(0,boardEl.classList.contains("keyboard-input"));setBusy(false);
  if(state.guided){markMove(OPENING_MOVE);tip("將亮起嘅"+state.menu[0].shortName+"向左掃，每件 +30");}
  else tip("交換相鄰兩格，指定食物每件 +30");
}
function finish(){
  if(state.over)return;
  state.over=true;setBusy(false);
  const previous=Math.max(best,storedBest());
  best=Math.max(previous,state.score);
  if(best>previous)save(bestKey,best);
  $("finalScore").textContent=format(state.score);
  $("finalHand").textContent="+"+format(state.bestHand);
  $("roundSummary").textContent="任食完成";
  $("resultFavorites").replaceChildren(...state.favorites.map((type,i)=>{
    const row=document.createElement("div"), name=document.createElement("dt"), count=document.createElement("dd");
    name.textContent=state.menu[type].name;count.textContent="已消 "+format(state.favoriteCounts[i])+" "+state.menu[type].unit;
    name.prepend(foodThumbnail(type,state.menu));row.append(name,count);return row;
  }));
  const recordMessage=previous===0?"首個任食紀錄":state.score>previous?"刷新個人歷史最佳！":state.score===previous?"追平個人歷史最佳！":"";
  paintStats();shell.finish(recordMessage);
  announce("挑戰完成，本局 "+format(state.score)+" 分，本局最高單啖得分 "+format(state.bestHand)+" 分。");
}
function retireGuide(){if(state.guided){state.guided=false;save(guideKey,1);}}
async function mixBoard(){
  const next=reshuffle(state.board);
  state.board=next;paintBoard();await tiles.shuffle(next);
}
async function rescueBoard(){
  setSelection(null);clearMarks();
  tip("冇得交換，自動洗牌");announce("冇有效交換，免費洗牌，唔扣啖數。");
  await mixBoard();
}
function formationText(code){
  if(code===GOLD_ICON)return "五連！金色 Storellet Icon";
  return kindOf(code)==="row"?"四連！橫掃箭嘴":"四連！直掃箭嘴";
}
function playTaste(types,preview=false,bonusMoves=1){
  const type=types[0];
  announce(preview?"預覽 Storellet仔幸福爆燈漫畫":"金色 Icon 燒中"+types.map(i=>state.menu[i].name).join("同")+"，幸福爆燈，獎勵 "+bonusMoves+" 啖！");
  return showAwakening({food:state.menu[type],foods:types.map(i=>state.menu[i]),preview,bonusMoves,thumbnail:foodThumbnail(type,state.menu)});
}
async function settle(first){
  let plan=first,earned=0;
  const extraBefore=state.extraMoves;
  state.handScore=0;
  const handBadge=$("handScore").parentElement;
  handBadge.classList.remove("score-settled");
  while(plan.hits.length){
    const award=scoreWave(state,plan);
    earned+=award.earned;
    const upgrade=plan.upgrades.find(up=>up.code===GOLD_ICON) || plan.upgrades[0];
    const goldFired=plan.effects.some(effect=>effect.kind==="gold");
    const headline=plan.conversion?"金箭連發！":goldFired?"金色 Icon 發動！":plan.effects.length?"箭嘴爆發！":upgrade?formationText(upgrade.code):
      plan.hits.length===1?"移除一格":"食物消除";
    tip(headline+"　呢啖 +"+format(state.handScore));paintStats();
    await tiles.clear(plan,award.cells);
    // Run the cut-in after the matching foods burn. Scoring and the extra move are already committed.
    if(award.celebration){
      await tiles.readAwakeningScores();
      if(award.celebration==="double-gold"){
        announce("雙金優惠爆發！呢次發達啦！獎勵 "+award.bonusMoves+" 啖。");
        await showDoubleGold({bonusMoves:award.bonusMoves});
      } else await playTaste(award.wakeFoods,false,award.bonusMoves);
    }
    const drop=dropWave(state.board,plan);
    state.board=drop.board;paintBoard();await tiles.fall(drop.board,drop.fromRow);
    plan=naturalWave(state.board);
  }
  finishBite(state);paintStats();
  const extra=state.extraMoves-extraBefore;
  const note="呢啖共 +"+format(state.previousBite)+" 分"+(earned?" · 移除 +"+earned:"")+(extra?" · 多食 "+extra+" 啖":"");
  handBadge.classList.add("score-settled");tip(note);
  announce(note+"，剩餘 "+state.moves+" 啖。");
  if(roundFinished(state)){
    // Keep the final hand and its numbers readable before the results cover the board.
    if(!document.hidden)await new Promise(resolve=>setTimeout(resolve,400));
    finish();return;
  }
  if(!findMove(state.board)){
    await rescueBoard();tip("已免費洗牌 · 剩餘 "+state.moves+" 啖");
  }
  setBusy(false);
}
async function playSwap(a,b,dragged=0){
  if(!interactive() || removing || !adjacent(a,b))return;
  setBusy(true);setSelection(null);clearMarks();setFocus(b);
  const plan=planSwap(state.board,a,b,state.favorites);await tiles.swap(a,b,dragged);
  if(!plan){
    await tiles.swap(b,a);
    if(state.guided)markMove(OPENING_MOVE);
    const msg=state.guided?"未連成三件，試向左掃亮住嗰格":"未連成三件，唔扣啖數";
    tip(msg);announce(msg);setBusy(false);return;
  }
  state.board=swapped(state.board,a,b);paintBoard();retireGuide();state.moves--;paintStats();
  await settle(plan);
}
async function useRemoval(pos){
  if(!interactive() || !removing)return;
  const plan=takeRemoval(state,pos);if(!plan)return;
  setRemoving(false);setBusy(true);retireGuide();clearMarks();setSelection(null);setFocus(pos);
  await settle(plan);
}
function choose(pos){
  if(!interactive())return;
  if(removing){void useRemoval(pos);return;}
  setFocus(pos);
  if(selected===pos){setSelection(null);return;}
  if(selected!==null && adjacent(selected,pos)){void playSwap(selected,pos);return;}
  setSelection(pos);
  const kind=kindOf(state.board[pos]);
  tip(kind==="gold"?"換隔籬食物，金色 Icon 會燒走同款":kind==="row"?"配成三連，箭嘴會橫掃一行":kind==="column"?"配成三連，箭嘴會直掃一列":"再點隔籬一格交換");
}
function dragPosition(p,x,y){
  const dx=x-p.x, dy=y-p.y;
  if(!p.axis && Math.max(Math.abs(dx),Math.abs(dy))>=5)p.axis=Math.abs(dx)>=Math.abs(dy)?"x":"y";
  if(!p.axis)return null;
  const delta=p.axis==="x"?dx:dy;
  const next=p.pos+Math.sign(delta)*(p.axis==="x"?1:SIZE);
  return adjacent(p.pos,next)?{next,progress:Math.min(1,Math.abs(delta)/p.size)}:null;
}
function drawDrag(p){
  const drag=dragPosition(p,p.latestX,p.latestY);
  if(p.to!==null && p.to!==drag?.next){
    // A direction change passes the home position before crossing to the other side.
    void tiles.releaseDrag(p.pos,p.to,0);p.to=null;p.progress=0;
  }
  if(!drag)return;
  p.to=drag.next;p.progress=drag.progress;tiles.drag(p.pos,p.to,p.progress);
}
async function unpreview(p) {
  if(p.to===null)return;
  setBusy(true);await tiles.releaseDrag(p.pos,p.to);setBusy(false);
}
boardEl.addEventListener("pointerdown",e=>{
  const cell=e.target.closest(".cell");
  if(!cell || e.button!==0 || !interactive())return;
  pointer={id:e.pointerId,pos:Number(cell.dataset.pos),x:e.clientX,y:e.clientY,latestX:e.clientX,latestY:e.clientY,
    size:boardEl.clientWidth/SIZE,removing,axis:null,to:null,progress:0,frame:0};
  boardEl.setPointerCapture(e.pointerId);
});
boardEl.addEventListener("pointermove",e=>{
  const p=pointer;
  if(!p || p.id!==e.pointerId || p.removing)return;
  p.latestX=e.clientX;p.latestY=e.clientY;
  if(!p.frame)p.frame=requestAnimationFrame(()=>{p.frame=0;if(pointer===p)drawDrag(p);});
});
boardEl.addEventListener("pointerup",e=>{
  const p=pointer;if(!p || p.id!==e.pointerId)return;
  pointer=null;cancelAnimationFrame(p.frame);
  if(p.removing){
    if(Math.hypot(e.clientX-p.x,e.clientY-p.y)<p.size*.25)choose(p.pos);
    return;
  }
  const drag=dragPosition(p,e.clientX,e.clientY);
  if(drag && drag.progress>=.25){
    if(p.to!==null && p.to!==drag.next){void tiles.releaseDrag(p.pos,p.to,0);}
    void playSwap(p.pos,drag.next,p.to===drag.next?p.progress:0);return;
  }
  if(p.to!==null){void unpreview(p);return;}
  if(!p.axis)choose(p.pos);
});
function cancelPointer(e){
  const p=pointer;if(!p || p.id!==e.pointerId)return;
  pointer=null;cancelAnimationFrame(p.frame);void unpreview(p);
}
boardEl.addEventListener("pointercancel",cancelPointer);
boardEl.addEventListener("lostpointercapture",cancelPointer);
boardEl.addEventListener("click", e => {
  const cell = e.target.closest(".cell");
  if (cell && e.detail === 0) choose(Number(cell.dataset.pos));
});
boardEl.addEventListener("keydown", e => {
  const deltas = { ArrowLeft:-1, ArrowRight:1, ArrowUp:-SIZE, ArrowDown:SIZE };
  if (!interactive()) return;
  if (e.key === "Escape") { setSelection(null); return; }
  if (!(e.key in deltas)) return;
  e.preventDefault();
  const to = focusCell+deltas[e.key]; if (adjacent(focusCell,to)) setFocus(to,true);
});
$("removeButton").addEventListener("click",()=>{
  if(!interactive() || !state.removals)return;
  setSelection(null);clearMarks();setRemoving(!removing);
  const msg=removing?"點一格，特殊食物照樣引爆 · 唔扣啖數":"已取消移除";
  tip(msg);announce(msg);
});
document.addEventListener("keydown",event=>{
  if(event.key==="Escape" && removing && interactive()){setRemoving(false);tip("已取消移除");}
});
$("hintButton").addEventListener("click",async()=>{
  if(!interactive())return;
  setSelection(null);setRemoving(false);
  let pair,msg;
  if(state.guided){
    pair=OPENING_MOVE;msg="將亮起嘅"+state.menu[0].shortName+"向左掃，每件 +30";
  }else{
    let hint=suggestMove(state.board,state.favorites);
    if(!hint){
      setBusy(true);await rescueBoard();setBusy(false);
      hint=suggestMove(state.board,state.favorites);
    }
    if(!hint)return;
    pair=hint.pair;
    const reason=hint.doubleGold?"雙金清全盤 · 獎勵 3 啖":hint.conversion?"金箭連發":hint.awakens?"幸福爆燈 · 獎勵 1 啖":hint.gold?"砌金色 Icon":hint.arrows?"砌箭嘴":hint.firesArrow?"箭嘴掃線":"跟箭嘴交換";
    msg=reason+" · 至少 +"+format(hint.points)+" 分";
  }
  markMove(pair);tip(msg);
  announce(msg+"。由"+cells[pair[0]].getAttribute("aria-label")+"移到"+cells[pair[1]].getAttribute("aria-label"));
});
$("shuffleInHelp").addEventListener("click",async()=>{
  if(!shell.isPlaying() || !help.open || state.busy || state.over || !state.shuffle)return;
  help.close();setSelection(null);setRemoving(false);clearMarks();retireGuide();state.shuffle--;setBusy(true);
  await mixBoard();setBusy(false);tip("已免費洗牌，啖數照舊");announce("已免費洗牌，啖數照舊。");
});
for(const [i,id] of ["previewAwakening","previewDrinkAwakening"].entries())$(id).addEventListener("click",async()=>{
  if(!shell.isPlaying() || !help.open || state.busy || state.over)return;
  help.close();setBusy(true);await playTaste([state.favorites[i]],true);setBusy(false);
  help.showModal();$(id).focus({preventScroll:true});
});
$("previewDoubleGold").addEventListener("click",async()=>{
  if(!shell.isPlaying() || !help.open || state.busy || state.over)return;
  help.close();setBusy(true);await showDoubleGold({preview:true});setBusy(false);
  help.showModal();$("previewDoubleGold").focus({preventScroll:true});
});
function openHelp(origin="play"){
  if(origin==="play")setRemoving(false);
  for(const id of ["previewAwakening","previewDrinkAwakening","previewDoubleGold","shuffleInHelp","quitGame"])$(id).hidden=origin!=="play";
  help.querySelector(".menu-guide").hidden=origin!=="play";
  $("backToBoard").textContent=origin==="play"?"繼續玩":"知道喇";
  help.showModal();
}
$("helpButton").addEventListener("click",()=>{if(interactive())openHelp();});
$("closeHelp").addEventListener("click",()=>help.close());$("backToBoard").addEventListener("click",()=>help.close());
$("quitGame").addEventListener("click",()=>{help.close();shell.quit();});
shell=createShell({
  onStart:()=>{newRound(read(guideKey)!=="1");},
  onHelp:openHelp,
  onExit:()=>{setSelection(null);clearMarks();setRemoving(false);state.over=true;setBusy(false);},
  getBest:()=>Math.max(best,storedBest())
});
newRound(read(guideKey)!=="1");
