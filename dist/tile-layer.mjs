import { GOLD_ICON, FAVORITE_GOLD_POINTS, SIZE, MENU, foodType, kindOf } from "./engine.mjs?v=18";

const position = (x,y) => "translate3d(" + x*100 + "%," + y*100 + "%,0)";
const point = pos => [pos%SIZE,Math.floor(pos/SIZE)];
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

function tween(node,frames,duration,easing="ease-out",delay=0) {
  if(reduced.matches || !node.animate) return Promise.resolve();
  const effect=node.animate(frames,{duration,easing,delay,fill:delay ? "backwards" : "none"});
  return effect.finished.catch(()=>{});
}
function sprite(index,cls) {
  const el=document.createElement("span");
  el.className=cls;
  el.style.backgroundPositionX=(index*12.5)+"%";
  return el;
}
const foodPositions=["2.311708% 7.215007%","26.845638% 6.926407%","49.515287% 4.617605%","73.378076% 6.349206%","97.613721% 6.637807%","2.535421% 50.216450%","26.845638% 50.072150%","49.813572% 49.639250%","73.079791% 50.505051%","97.240865% 50.360750%","2.311708% 93.795094%","26.994780% 92.929293%","49.515287% 93.506494%","73.452647% 92.352092%","97.539150% 93.217893%"];
function foodArt(type,menu,cls){
  const food=menu[type],el=document.createElement("span"),index=food.artIndex;
  el.className=cls+" food-art";el.dataset.food=food.id;
  if(food.image){
    el.style.backgroundImage='url("'+food.image+'")';
    el.style.backgroundSize="contain";
    el.style.backgroundPosition="center";
  }else el.style.backgroundPosition=foodPositions[index];
  return el;
}
export function foodThumbnail(type,menu=MENU) {
  return foodArt(type,menu,"food-thumbnail");
}
function face(code,menu=MENU) {
  if(code===GOLD_ICON){
    const icon=document.createElement("span");
    icon.className="tile-face tile-gold";
    const rim=svgPart(icon,"svg",{class:"gold-rim",viewBox:"0 0 100 100","aria-hidden":"true",focusable:"false"});
    for(const cls of ["gold-rim-track","gold-rim-trail","gold-rim-spark"])
      svgPart(rim,"rect",{class:cls,x:8.5,y:8.5,width:83,height:83,rx:21,pathLength:100});
    return icon;
  }
  const el=foodArt(foodType(code),menu,"tile-face");
  const kind=kindOf(code);
  if(kind==="row" || kind==="column") el.append(sprite(kind==="row"?7:8,"tile-badge"));
  return el;
}
function createTile(code,x,y,menu) {
  const node=document.createElement("span");
  node.className="moving-tile";node.dataset.kind=kindOf(code);
  node.style.transform=position(x,y);
  const art=face(code,menu);node.append(art);
  return {node,art,code,x,y};
}
// The CSS base pose always matches the final keyframe, including when a tab resumes.
function moveTo(tile,x,y,duration,easing) {
  if(tile.x===x && tile.y===y && !tile.previewed)return null;
  const from=tile.node.style.transform || position(tile.x,tile.y), to=position(x,y);
  tile.previewed=false;
  tile.x=x;tile.y=y;tile.node.style.transform=to;
  if(from===tile.node.style.transform)return null;
  return tween(tile.node,[{transform:from},{transform:to}],duration,easing);
}
// SVG coordinates follow the tile grid, even when the board changes size mid-wave.
const CELL = 100;
const EDGE = SIZE * CELL;
const GOLD_LIGHT = ["#efab42", "#ffd568", "#fff0ab", "#f6c87d", "#ffe5a0"];
const FOOD_LIGHT = ["#ffb5a4", "#bbf3a5", "#ffe48e", "#ffd1e3", "#e4e7e8", "#efc09b"];
const FOOD_FLARE = ["#f66a51","#83ca58","#ffbb39","#f38fac","#aebac1","#c58b60"];
const FORM_STRIPE = {reveal:330, settle:180, end:680};
const FORM_GOLD = {reveal:480, settle:240, end:920};
// Leave time to see the whole board arm, then hear/see three distinct beats.
const salvoAt = batch => 950+560*batch;
const FOUR_CALLOUT = {text:"四連！",rank:1,at:165,life:470};
const CALLOUTS = {
  "form-row":FOUR_CALLOUT, "form-column":FOUR_CALLOUT,
  "fire-row":{text:"橫掃！",rank:2,at:60,life:505},
  "fire-column":{text:"直掃！",rank:2,at:60,life:505},
  "form-gold":{text:"五連！",rank:3,at:255,life:595},
  "fire-gold":{text:"同款全消！",rank:4,at:75,life:660},
  "convert-gold":{text:"金箭連發！",rank:5,at:180,life:1040}
};
const cellCenter = pos => point(pos).map(v => (v+.5)*CELL);
const distance = (a,b) => Math.hypot(a%SIZE-b%SIZE, Math.floor(a/SIZE)-Math.floor(b/SIZE));
const formation = code => code === GOLD_ICON ? FORM_GOLD : FORM_STRIPE;

function svgPart(parent, tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg",tag);
  for(const [key,value] of Object.entries(attrs)) el.setAttribute(key,value);
  if(parent) parent.append(el);
  return el;
}
function timed(el,at,life) {
  el.style.setProperty("--at",Math.round(at)+"ms");
  el.style.setProperty("--life",Math.round(life)+"ms");
  return el;
}
function path(parent,cls,d,at,life) {
  return timed(svgPart(parent,"path",{class:cls,d,pathLength:100}),at,life);
}
function ring(parent,cls,x,y,r,at,life) {
  return timed(svgPart(parent,"circle",{class:cls,cx:x,cy:y,r,pathLength:100}),at,life);
}
let waveId=0;
function makeWave(upgrades=[]) {
  const svg=svgPart(null,"svg",{class:"wave-fx",viewBox:"0 0 "+EDGE+" "+EDGE,
    preserveAspectRatio:"none","aria-hidden":"true",focusable:"false"});
  return {svg,prefix:"wave-"+ ++waveId,hitAt:new Map(),impacts:new Map(),ringed:new Set(),
    protected:new Set(upgrades.map(up=>up.pos)),sparkCount:0,callout:null,end:0};
}
function markImpact(wave,pos,time) {
  // A cell in two powers stays visible until both travelling effects have reached it.
  wave.hitAt.set(pos,Math.max(wave.hitAt.get(pos) || 0,Math.round(time)));
}
function spark(wave,parent,cls,d,at,life) {
  if(wave.sparkCount>=18)return;
  wave.sparkCount++;
  if(cls==="fx-gather")path(parent,"fx-gather-wake",d,at,life);
  path(parent,cls,d,at,life);
}
function groupFor(wave,action,kind,pos) {
  const event=action+"-"+kind, cue=CALLOUTS[event];
  if(!wave.callout || cue.rank>wave.callout.rank)wave.callout={...cue,pos,event};
  return svgPart(wave.svg,"g",{"data-fx":event,"data-origin":pos});
}
function drawCallout(wave) {
  const {text,pos,event,at,life}=wave.callout,[cx,cy]=cellCenter(pos);
  // An explicit text length keeps corner labels inside the mat across CJK fonts.
  // The adjacent row leaves the entire source food clear, including its halo.
  const width=44*text.length, margin=Math.ceil(width*.54)+8;
  const x=Math.max(margin,Math.min(EDGE-margin,cx)), y=cy+(cy<CELL ? 88 : -86);
  const group=svgPart(wave.svg,"g",{"data-callout":event,"data-anchor":pos,
    transform:"translate("+x+" "+y+")"});
  const label=timed(svgPart(group,"text",{class:"fx-callout","text-anchor":"middle",
    "dominant-baseline":"central",textLength:width,lengthAdjust:"spacingAndGlyphs"}),at,life);
  label.textContent=text;
}

// Walk the actual matched cells back to the anchor. At a T or L the light turns
// through the matching food at the elbow instead of cutting across another food.
function parentsInMatch(cells,anchor) {
  const members=new Set(cells), parents=new Map([[anchor,null]]), queue=[anchor];
  for(let i=0;i<queue.length;i++){
    const pos=queue[i], col=pos%SIZE;
    const around=[pos-SIZE,pos+SIZE,col ? pos-1 : -1,col<SIZE-1 ? pos+1 : -1];
    for(const next of around){
      if(!members.has(next) || parents.has(next))continue;
      parents.set(next,pos);queue.push(next);
    }
  }
  return parents;
}
function rewardSeal(group,pos,kind,reveal,end) {
  const [x,y]=cellCenter(pos),gold=kind==="gold";
  const at=svgPart(group,"g",{transform:"translate("+x+" "+y+")"});
  const seal=timed(svgPart(at,"g",{class:"fx-seal"}),reveal-55,end-reveal+55);
  svgPart(seal,"circle",{class:"fx-seal-rim",r:43});
  if(gold){
    // Four gilded arcs leave the artwork open at the centre.
    ["#ffb74f","#ffe49a","#fff2c0","#f6c06a"].forEach((stroke,i)=>{
      svgPart(seal,"path",{class:"fx-enamel",d:"M -28 -34 A 44 44 0 0 1 25 -36",
        transform:"rotate("+90*i+")",stroke});
    });
    svgPart(seal,"path",{class:"fx-glint",d:"m 35 -32 2 -7 2 7 6 2 -6 2 -2 7 -2 -7 -6 -2 z M -38 23 l 1.5 -5 1.5 5 4.5 1.5 -4.5 1.5 -1.5 5 -1.5 -5 -4.5 -1.5 z"});
  }else{
    svgPart(seal,"path",{class:"fx-direction",transform:kind==="row"?"rotate(0)":"rotate(90)",
      d:"M -36 -9 -45 0 -36 9 M 36 -9 45 0 36 9"});
  }
}
function drawFormation(wave,{pos,code,cells}) {
  const kind=kindOf(code), gold=code===GOLD_ICON, clock=formation(code);
  const group=groupFor(wave,"form",kind,pos), parents=parentsInMatch(cells,pos);
  const donors=[...parents.keys()].filter(p=>p!==pos);
  const rail=donors.map(p=>"M "+cellCenter(p)+" L "+cellCenter(parents.get(p))).join(" ");
  path(group,"fx-rail",rail,0,clock.reveal+95);
  const longest=Math.max(1,...donors.map(p=>distance(p,pos)));
  donors.forEach((from,i)=>{
    const [x,y]=cellCenter(from), fraction=distance(from,pos)/longest;
    const at=44+54*(1-fraction), travel=clock.reveal-at-22-(i%3)*11;
    const donor=svgPart(group,"g",{"data-from":from});
    donor.style.setProperty("--ink",gold ? GOLD_LIGHT[i%GOLD_LIGHT.length] : "#ffdc83");
    ring(donor,"fx-donor",x,y,35,0,at+travel*.65);
    const steps=[cellCenter(from)];
    for(let next=parents.get(from);next!==null;next=parents.get(next))steps.push(cellCenter(next));
    spark(wave,donor,"fx-gather","M "+steps.join(" L "),at,travel);
    markImpact(wave,from,at+travel*.44);
  });
  // The protected food earns its points as it gathers, before its face changes.
  markImpact(wave,pos,clock.reveal*.48);
  rewardSeal(group,pos,kind,clock.reveal,clock.end);
  wave.end=Math.max(wave.end,clock.end);
}

// Each burst animates two small instances of shared artwork. The three chips are
// drawn together, so even a 49-cell hit has only one debris animation per cell.
function impactArt(wave) {
  if(wave.art)return;
  wave.art=svgPart(wave.svg,"defs",{});
  const shape=svgPart(wave.art,"g",{id:wave.prefix+"-star"});
  svgPart(shape,"path",{class:"fx-burst-shell",d:"M -49 -9 -29 -15 -34 -33 -13 -24 -8 -48 4 -30 21 -42 20 -23 44 -30 34 -10 52 -2 34 7 44 23 22 19 25 39 7 29 -1 48 -12 31 -30 42 -26 22 -46 23 -35 9 -52 5 -34 -2 Z"});
  svgPart(shape,"path",{class:"fx-burst-fire",d:"M -33 -5 -17 -10 -21 -24 -6 -18 -2 -32 5 -18 17 -26 15 -14 31 -18 23 -4 35 1 20 8 27 18 13 15 13 28 3 19 -5 31 -9 18 -22 25 -18 11 -33 12 -24 3 Z"});
  svgPart(shape,"path",{class:"fx-burst-core",d:"M -22 -1 -8 -5 -13 -16 -2 -10 3 -23 7 -10 20 -14 12 -2 23 3 9 7 13 17 2 12 -5 23 -7 11 -19 16 -13 6 Z"});
  const chips=svgPart(wave.art,"g",{id:wave.prefix+"-chips"});
  svgPart(chips,"path",{class:"fx-chip-ink",d:"M -45 -26 -57 -30 -52 -18 -44 -19 Z M 26 -42 32 -55 38 -52 33 -39 Z M 32 34 44 36 46 43 34 40 Z"});
  const aim=svgPart(wave.art,"g",{id:wave.prefix+"-lock"});
  const corners="M -36 -16 -36 -29 -29 -36 -16 -36 M 16 -36 29 -36 36 -29 36 -16 M 36 16 36 29 29 36 16 36 M -16 36 -29 36 -36 29 -36 16";
  svgPart(aim,"path",{class:"fx-lock-ink",d:corners});
  svgPart(aim,"path",{class:"fx-lock-light",d:corners});
}
function impactUse(wave,parent,id,cls,at,life) {
  return timed(svgPart(parent,"use",{class:cls,href:"#"+wave.prefix+"-"+id}),at,life);
}
function stripeArt(wave) {
  if(wave.stripeArt)return;
  impactArt(wave);wave.stripeArt=true;
  const head=svgPart(wave.art,"g",{id:wave.prefix+"-jet"});
  svgPart(head,"path",{class:"fx-jet",d:"M -97 -4 -53 -12 -32 -10 -45 -24 -15 -17 -21 -32 12 -6 18 0 -18 31 -13 17 -46 24 -32 10 -74 14 -58 5 -94 5 Z"});
  svgPart(head,"path",{class:"fx-jet-core",d:"M -78 0 -36 -5 -19 -5 -27 -16 -8 -9 1 -11 10 0 -14 14 -9 7 -32 10 -24 4 Z"});
  svgPart(head,"path",{class:"fx-shockfront",d:"M 10 -29 Q 34 -2 13 18 L 6 28 M -89 -13 -72 -14 M -75 20 -57 19"});
  svgPart(wave.art,"path",{id:wave.prefix+"-wick",d:"M -49 -17 -35 0 -49 17 M 49 -17 35 0 49 17 M -6 -42 0 -32 6 -42 M -6 42 0 32 6 42"});
}
function queueImpact(wave,parent,pos,at,origin,{shell="#ffa23c",locked=false}={}) {
  // The gold icon locks its timed chain. Elsewhere, the first passing beam claims the
  // physical hit; newly formed awards stay in place even under a crossing beam.
  const prior=wave.impacts.get(pos);
  if(wave.protected.has(pos) || (prior && (prior.locked || prior.at<=at)))return;
  const [x,y]=cellCenter(pos),[ox,oy]=cellCenter(origin),length=Math.hypot(x-ox,y-oy);
  wave.impacts.set(pos,{parent:prior?.parent || parent,pos,at:Math.round(at),shell,locked,
    dx:length ? (x-ox)/length : 0,dy:length ? (y-oy)/length : -1});
}
function drawImpacts(wave) {
  if(!wave.impacts.size)return;
  impactArt(wave);
  const hits=[...wave.impacts.values()],crowded=hits.length>16;
  for(const hit of hits)hit.at=Math.max(hit.at,wave.hitAt.get(hit.pos) || 0);
  if(crowded){
    wave.svg.setAttribute("class","wave-fx fx-crowd");
    hits.sort((a,b)=>a.at-b.at || a.pos-b.pos);
    for(let i=1;i<hits.length;i++)hits[i].at=Math.max(hits[i].at,hits[i-1].at+8);
    wave.end=Math.max(wave.end,hits[hits.length-1].at+180);
  }
  for(const hit of hits){
    const {parent,pos,shell}=hit,[x,y]=cellCenter(pos);
    wave.hitAt.set(pos,hit.at);
    const burst=svgPart(parent,"g",{"data-impact":pos,"data-at":hit.at,
      transform:"translate("+x+" "+y+") rotate("+((pos*29)%58-29)+")"});
    burst.style.setProperty("--shell",shell);
    impactUse(wave,burst,"star","fx-burst-body",hit.at,wave.conversionGroup ? 240 : crowded ? 157 : 211);
    impactUse(wave,burst,"chips","fx-chips",hit.at+12,wave.conversionGroup ? 280 : crowded ? 168 : 228);
  }
}
function drawStripe(wave,kind,pos,offset=0,{batch,rail="full",travel=349,tail=274,targets}={}) {
  stripeArt(wave);
  const group=groupFor(wave,"fire",kind,pos), horizontal=kind==="row";
  const [x,y]=cellCenter(pos),axis=horizontal ? x : y;
  const reach=Math.max(axis,EDGE-axis), start=offset+112, timePerUnit=travel/reach;
  if(batch!==undefined){
    for(const [key,value] of Object.entries({launch:pos,kind,batch,at:start,rail}))
      group.setAttribute("data-"+key,value);
  }
  ring(group,"fx-ignite",x,y,38,offset,205);
  timed(svgPart(group,"use",{class:"fx-wick",href:"#"+wave.prefix+"-wick",
    transform:"translate("+x+" "+y+") rotate("+(horizontal ? 0 : 90)+")"}),offset,167);
  for(const edge of [0,EDGE]){
    // Arrows sharing a rail in the same volley each get two distinct muzzle
    // packets. The long rail is painted once; later volleys can reuse the line.
    const length=Math.abs(edge-axis),local=rail==="shared",end=local ? axis+Math.sign(edge-axis)*Math.min(95,length) : edge;
    const to=horizontal ? [end,y] : [x,end], d="M "+[x,y]+" L "+to;
    const flight=local ? Math.min(134,Math.abs(end-axis)*1.42) : length*timePerUnit;
    const layers=rail==="full" ? ["fx-lane-bed","fx-lane","fx-lane-core"] : rail==="light" ? ["fx-lane fx-salvo-rail"] : [];
    for(const cls of layers){
      const lane=path(group,cls,d,start,flight+113);
      lane.style.setProperty("--travel",Math.round(flight)+"ms");
    }
    const front=timed(svgPart(group,"g",{class:"fx-front"}),start,flight);
    front.style.setProperty("--dx",to[0]-x+"px");front.style.setProperty("--dy",to[1]-y+"px");
    const angle=(horizontal ? 0 : 90)+(edge===0 ? 180 : 0);
    // A broad ink-edged packet and a curved shockfront face the direction of travel.
    svgPart(front,"use",{href:"#"+wave.prefix+"-jet",transform:"translate("+x+" "+y+") rotate("+angle+")"+(rail==="full" ? "" : " scale(.67)")});
  }
  const first=horizontal ? Math.floor(pos/SIZE)*SIZE : pos%SIZE, step=horizontal ? 1 : SIZE;
  for(const target of targets || Array.from({length:SIZE},(_,i)=>first+step*i)){
    const arrive=start+distance(pos,target)*CELL*timePerUnit;
    const dest=wave.ringed.has(target) ? group : svgPart(group,"g",{"data-target":target});
    wave.ringed.add(target);queueImpact(wave,dest,target,arrive,pos);
  }
  wave.end=Math.max(wave.end,start+travel+tail);
}

function drawConversion(wave,conversion,effects) {
  impactArt(wave);
  const {goldPos,origin,type,stripes}=conversion, [x,y]=cellCenter(goldPos);
  const group=groupFor(wave,"convert","gold",goldPos);
  wave.conversionGroup=group;
  group.setAttribute("data-partner",origin);group.setAttribute("data-food",type);
  const ink=FOOD_LIGHT[type] || "#ffe4a3";
  group.style.setProperty("--ink",ink);
  ring(group,"fx-gold-origin",x,y,41,0,850);
  markImpact(wave,goldPos,760);
  wave.ringed.add(goldPos);
  const sample=Math.max(1,Math.ceil(stripes.length/7));
  // Target brackets remain in front of passing jets until that food's own
  // launch. All badges and brackets appear at once, including the original.
  wave.sights=svgPart(null,"g",{"data-sights":goldPos});
  stripes.forEach(({pos,kind,batch},i)=>{
    const [tx,ty]=cellCenter(pos), at=salvoAt(batch);
    const marker=svgPart(wave.sights,"g",{"data-convert":pos,"data-kind":kind,
      "data-batch":batch,"data-at":0,"data-until":at,"data-target":pos,
      transform:"translate("+tx+" "+ty+")"});
    const lock=impactUse(wave,marker,"lock","fx-convert-lock",at,72);
    lock.setAttribute("data-lock",pos);
    wave.ringed.add(pos);
    const link=path(group,"fx-trace","M "+[x,y]+" L "+[tx,ty],40,400);
    link.style.setProperty("--travel","300ms");
    if(i%sample===0)spark(wave,group,"fx-signal","M "+[x,y]+" L "+[tx,ty],50,320);
    // Reserve both the visible tile and its one paid hit. Crossing it in a
    // previous volley cannot consume a pending shooter.
    markImpact(wave,pos,at);
    queueImpact(wave,group,pos,at,pos,{shell:FOOD_FLARE[type],locked:true});
  });
  const routes=new Set(),shots=new Map(effects.filter(e=>e.kind!=="gold").map(e=>[e.pos,e.targets]));
  for(const {pos,kind,batch} of stripes){
    const route=batch+":"+kind+":"+(kind==="row" ? Math.floor(pos/SIZE) : pos%SIZE);
    const rail=routes.has(route) ? "shared" : routes.size<8 ? "full" : "light";
    routes.add(route);
    drawStripe(wave,kind,pos,salvoAt(batch)-112,{batch,rail,travel:460,tail:300,targets:shots.get(pos)});
  }
  wave.end=Math.max(wave.end,1800);
}

// A pair of gold icons can both nominate every cell. Give each food one visible link
// from its nearest eligible icon, keeping a full-board clear readable.
function goldSequence(icons,offset=0) {
  const owners=new Map();
  for(const icon of icons)for(const target of icon.targets){
    const prior=owners.get(target);
    if(prior===undefined || distance(icon.pos,target)<distance(prior,target))owners.set(target,icon.pos);
  }
  const targets=[...owners.keys()].filter(pos=>pos!==owners.get(pos));
  targets.sort((a,b)=>distance(owners.get(a),a)-distance(owners.get(b),b) || a-b);
  const dense=targets.length>16, first=targets.length===1 ? 290 : 248;
  const span=targets.length<2 ? 0 : Math.min(dense ? 496 : 402,Math.max(180,(targets.length-1)*48));
  const times=new Map(targets.map((pos,i)=>[pos,offset+first+Math.round(span*i/Math.max(1,targets.length-1))]));
  return {owners,times,dense,offset,end:offset+(dense ? 975 : Math.max(735,first+span+266))};
}
function drawGold(wave,{pos,targets},sequence,tiles) {
  impactArt(wave);
  const {owners,times,dense,offset}=sequence;
  const group=groupFor(wave,"fire","gold",pos),[x,y]=cellCenter(pos);
  const chosen=targets.filter(p=>p!==pos && owners.get(p)===pos);
  const step=Math.max(1,Math.ceil(chosen.length/8));
  if(dense)group.setAttribute("class","fx-dense");
  ring(group,"fx-gold-origin",x,y,40,offset,400);
  wave.ringed.add(pos);
  const rays=timed(svgPart(group,"g",{class:"fx-gold-rays",transform:"translate("+x+" "+y+")"}),offset,260);
  svgPart(rays,"path",{d:"M -33 -24 -42 -31 M -12 -39 -15 -49 M 13 -39 17 -49 M 32 -27 39 -34"});
  svgPart(rays,"path",{class:"fx-glint",d:"M 32 -38 34 -44 36 -38 42 -36 36 -34 34 -28 32 -34 26 -36 Z"});
  let lastLaunch=0;
  chosen.forEach((target,i)=>{
    const [tx,ty]=cellCenter(target),dx=tx-x,dy=ty-y,dist=Math.hypot(dx,dy);
    const nx=dx/dist,ny=dy/dist,bend=(i%2 ? -1 : 1)*Math.min(27,dist*.12);
    const d="M "+[x+nx*22,y+ny*22]+" Q "+[(x+tx)/2-ny*bend,(y+ty)/2+nx*bend]+" "+[tx-nx*20,ty-ny*20];
    const arrive=times.get(target),flight=Math.min(arrive-offset-107,100+dist*.26),start=arrive-flight;
    lastLaunch=Math.max(lastLaunch,start);
    const dest=svgPart(group,"g",{"data-target":target});
    const type=foodType(tiles[target].code);
    dest.style.setProperty("--ink",FOOD_LIGHT[type] || "#ffe2a5");
    const trace=path(dest,"fx-trace",d,start,flight+(dense ? 38 : 65));
    trace.style.setProperty("--travel",Math.round(flight)+"ms");
    if(i%step===0)spark(wave,dest,"fx-signal",d,start,flight);
    const aim=svgPart(dest,"g",{transform:"translate("+tx+" "+ty+")"});
    const lockAt=dense ? arrive-155 : offset+21+(i%5)*8;
    const lock=impactUse(wave,aim,"lock","fx-lock",lockAt,arrive-lockAt+8);
    lock.setAttribute("data-lock",target);
    wave.ringed.add(target);queueImpact(wave,dest,target,arrive,pos,{shell:FOOD_FLARE[type],locked:true});
  });
  if(targets.includes(pos))queueImpact(wave,group,pos,offset+113,pos,{locked:true});
  else markImpact(wave,pos,Math.max(offset+368,lastLaunch+55));
  wave.end=Math.max(wave.end,sequence.end);
}
function drawTap(wave,pos) {
  const group=svgPart(wave.svg,"g",{"data-fx":"tap","data-origin":pos});
  const dest=svgPart(group,"g",{"data-target":pos});
  queueImpact(wave,dest,pos,10,pos);wave.end=260;
}
function playWave(layer,wave) {
  drawImpacts(wave);
  if(wave.sights){wave.conversionGroup.append(wave.sights);wave.svg.append(wave.conversionGroup);}
  if(wave.callout)drawCallout(wave);
  wave.svg.style.setProperty("--wave-life",wave.end+"ms");
  layer.append(wave.svg);
  // The real CSS clock owns the hold. A missing or zero-duration animation
  // (hidden board, skipped styles) must release gravity immediately.
  if(wave.svg.getAnimations){
    const clock=wave.svg.getAnimations().find(anim=>anim.animationName==="fx-wave-life");
    if(!clock || clock.effect.getComputedTiming().activeDuration<16){
      wave.svg.remove();return null;
    }
    return clock.finished.catch(()=>{}).finally(()=>wave.svg.remove());
  }
  return tween(wave.svg,[{opacity:1},{opacity:1,offset:.93},{opacity:0}],wave.end,"linear").finally(()=>wave.svg.remove());
}
async function upgrade(tile,code,animated) {
  const old=tile.art, kind=kindOf(code), clock=formation(code);
  if(animated){
    old.style.transform="scale(1.065)";
    await tween(old,[{transform:"scale(1)"},{transform:"scale(.98)",offset:.31},
      {transform:"scale(1.065)"}],clock.reveal,"ease-in-out");
  }
  tile.code=code;tile.node.dataset.kind=kind;
  old.style.transform="";
  if(code!==GOLD_ICON){
    const badge=sprite(kind==="row"?7:8,"tile-badge");
    old.replaceChildren(badge);
    if(animated)await Promise.all([
      tween(old,[{transform:"scale(1.065)"},{transform:"scale(1)"}],clock.settle),
      tween(badge,[{opacity:0,transform:"scale(.56)"},{opacity:1,transform:"scale(1.19)",offset:.61},
        {opacity:1,transform:"scale(1)"}],clock.settle)]);
    return;
  }
  const fresh=face(code);tile.art=fresh;
  tile.node.append(fresh);
  old.style.opacity="0";
  if(animated)await Promise.all([tween(old,[{opacity:1},{opacity:0}],145),
    tween(fresh,[{opacity:0,transform:"translateY(5%) scale(.77) rotate(-6deg)"},
      {opacity:1,transform:"translateY(-3%) scale(1.085) rotate(2deg)",offset:.62},
      {opacity:1,transform:"translateY(0) scale(1) rotate(0deg)"}],clock.settle)]);
  old.remove();
}

function conversionBadge({pos,kind,batch}) {
  const badge=sprite(kind==="row" ? 7 : 8,"tile-badge converted-badge");
  badge.dataset.pos=String(pos);badge.dataset.kind=kind;badge.dataset.batch=String(batch);
  return badge;
}

const SCORE_LIFE=640;
const SCORE_RISE=[
  {opacity:0,transform:"translateY(var(--score-from)) scale(.88)"},
  {opacity:1,transform:"translateY(var(--score-rest)) scale(1.045)",offset:.14},
  {opacity:1,transform:"translateY(var(--score-rest)) scale(1)",offset:.27},
  {opacity:1,transform:"translateY(var(--score-rest)) scale(1)",offset:.73},
  {opacity:0,transform:"translateY(var(--score-to)) scale(.98)"}
];
export class TileLayer {
  constructor(board) {
    this.el=document.createElement("div");
    this.el.className="tile-layer";this.el.setAttribute("aria-hidden","true");
    this.scoreLayer=document.createElement("div");
    this.scoreLayer.className="score-layer";this.scoreLayer.setAttribute("aria-hidden","true");
    board.append(this.el,this.scoreLayer);
    this.scoreWaves=new Set();
    this.scoreSlots=Array.from({length:SIZE*SIZE},()=>[0,0]);
    this.latestPremium=null;this.pendingScoreRead=null;
    this.still=null;
    this.menu=MENU;
    this.tiles=[];
  }
  reset(board,menu=this.menu) {
    this.clearScoreRead();
    this.clearStill();
    for(const entry of this.scoreWaves)this.endScores(entry);
    this.scoreSlots.forEach(slots=>slots.fill(0));
    this.menu=menu;
    this.tiles=board.map((code,pos)=>createTile(code,...point(pos),this.menu));
    this.el.replaceChildren(...this.tiles.map(tile=>tile.node));
  }
  clearStill() {
    if(!this.still)return;
    clearTimeout(this.still.timer);this.still.wrap.remove();this.still=null;
  }
  showStill(stripes) {
    const wrap=document.createElement("div");
    wrap.className="conversion-still";wrap.setAttribute("aria-hidden","true");
    for(const stripe of stripes){
      const {pos,kind,batch}=stripe,[x,y]=point(pos),mark=document.createElement("span");
      mark.dataset.convert=String(pos);mark.dataset.kind=kind;mark.dataset.batch=String(batch);
      mark.style.gridArea=(y+1)+" / "+(x+1);
      mark.append(conversionBadge(stripe));wrap.append(mark);
    }
    this.el.append(wrap);
    this.still={wrap,timer:setTimeout(()=>this.clearStill(),180)};
  }
  endScores(entry) {
    if(!this.scoreWaves.delete(entry))return;
    if(this.latestPremium===entry)this.clearScoreRead();
    clearTimeout(entry.timer);
    entry.wrap.remove();
    for(const motion of entry.motions)motion.cancel?.();
  }
  clearScoreRead() {
    this.latestPremium=null;
    this.pendingScoreRead?.finish();
  }
  readAwakeningScores() {
    const remaining=(this.latestPremium?.readThrough || 0)-performance.now();
    const hidden=()=>document.hidden || document.visibilityState==="hidden";
    if(remaining<=0 || hidden()){this.clearScoreRead();return Promise.resolve();}
    if(this.pendingScoreRead)return this.pendingScoreRead.promise;
    let resolveRead;
    const promise=new Promise(resolve=>{resolveRead=resolve;});
    const onVisibility=()=>{if(hidden())finish();};
    const finish=()=>{
      clearTimeout(timer);
      document.removeEventListener?.("visibilitychange",onVisibility);
      globalThis.removeEventListener?.("pagehide",finish);
      this.pendingScoreRead=null;this.latestPremium=null;resolveRead();
    };
    const timer=setTimeout(finish,Math.ceil(remaining));
    this.pendingScoreRead={promise,finish};
    document.addEventListener?.("visibilitychange",onVisibility);
    globalThis.addEventListener?.("pagehide",finish);
    return promise;
  }
  showScores(cells,hitAt) {
    this.clearScoreRead();
    if(!cells.length)return;
    const now=performance.now(),wrap=document.createElement("div"),notes=[];
    let lastPremium=-1;
    wrap.className="score-wave";wrap.dataset.count=String(cells.length);
    for(const {pos,points} of cells){
      const slots=this.scoreSlots[pos],hit=hitAt?.get(pos) || 0;
      // Two independent bands leave a falling piece free to earn a new label at
      // the same coordinate. A third immediate award can wait without holding play.
      const lane=slots[0]<=now+hit || slots[0]<=slots[1] ? 0 : 1;
      const at=Math.max(hit,Math.ceil(slots[lane]-now));
      slots[lane]=now+at+SCORE_LIFE;
      if(points===FAVORITE_GOLD_POINTS)lastPremium=Math.max(lastPremium,at);
      const [x,y]=point(pos),pop=document.createElement("span"),number=document.createElement("b");
      pop.className="score-pop";pop.dataset.pos=String(pos);pop.dataset.points=String(points);
      pop.dataset.at=String(at);pop.dataset.lane=String(lane);pop.style.gridArea=(y+1)+" / "+(x+1);
      number.textContent="+"+points;pop.append(number);wrap.append(pop);notes.push({number,at});
    }
    this.scoreLayer.append(wrap);
    const entry={wrap,motions:[],timer:0};
    this.scoreWaves.add(entry);
    const animated=!reduced.matches && !!notes[0].number.animate;
    if(lastPremium>=0){
      entry.readThrough=now+lastPremium+(animated ? 505 : 260);
      this.latestPremium=entry;
    }
    if(animated){
      let last,latest=-1;
      for(const {number,at} of notes){
        const motion=number.animate(SCORE_RISE,{duration:SCORE_LIFE,delay:at,easing:"linear"});
        entry.motions.push(motion);
        if(at>=latest){latest=at;last=motion;}
      }
      last.finished.then(()=>this.endScores(entry),()=>this.endScores(entry));
      return;
    }
    // Static awards use one pending timer for the whole wave, including browsers
    // without Web Animations. Reset cancels that timer and every attached label.
    wrap.dataset.static="true";
    const changes=notes.flatMap(({number,at})=>[
      {number,at,opacity:"1"},{number,at:at+SCORE_LIFE,opacity:"0"}
    ]).sort((a,b)=>a.at-b.at);
    let next=0;
    const advance=()=>{
      const elapsed=performance.now()-now;
      while(next<changes.length && changes[next].at<=elapsed+1){
        const change=changes[next++];change.number.style.opacity=change.opacity;
      }
      if(next===changes.length)this.endScores(entry);
      else entry.timer=setTimeout(advance,Math.max(1,changes[next].at-elapsed));
    };
    advance();
  }
  drag(a,b,progress) {
    const [ax,ay]=point(a),[bx,by]=point(b);
    const first=this.tiles[a],second=this.tiles[b];
    first.previewed=second.previewed=true;
    first.node.style.zIndex="2";second.node.style.zIndex="1";
    first.node.style.transform=position(ax+(bx-ax)*progress,ay+(by-ay)*progress);
    second.node.style.transform=position(bx+(ax-bx)*progress,by+(ay-by)*progress);
  }
  async releaseDrag(a,b,duration=90) {
    if(!duration){
      for(const pos of [a,b]){
        const tile=this.tiles[pos];
        tile.node.style.transform=position(...point(pos));tile.node.style.zIndex="";tile.previewed=false;
      }
      return;
    }
    await Promise.all([a,b].map(pos=>{
      const tile=this.tiles[pos];tile.node.style.zIndex="";
      return moveTo(tile,...point(pos),duration,"ease-out");
    }));
  }
  async swap(a,b,progress=0) {
    const duration=Math.max(55,Math.round(160*(1-progress)));
    const first=this.tiles[a],second=this.tiles[b];
    [this.tiles[a],this.tiles[b]]=[second,first];
    first.node.style.zIndex="2";second.node.style.zIndex="1";
    await Promise.all([moveTo(first,...point(b),duration,"cubic-bezier(.22,.05,.25,1)"),
      moveTo(second,...point(a),duration,"cubic-bezier(.22,.05,.25,1)")]);
    first.node.style.zIndex="";second.node.style.zIndex="";
  }
  beam(kind,pos,wave=null,offset=0) {
    if(reduced.matches || !this.el.animate || (kind!=="row" && kind!=="column"))return;
    const scene=wave || makeWave();
    drawStripe(scene,kind,pos,offset);
    if(!wave)return playWave(this.el,scene);
  }
  async clear(plan,scoredCells=[]) {
    this.clearStill();
    const tiles=this.tiles, work=[], conversion=plan.conversion, special=plan.upgrades.length || plan.effects.length;
    const tap=!special && plan.hits.length===1 && plan.remove.length===1;
    const staged=special || tap;
    let wave;
    if(staged && !reduced.matches && this.el.animate){
      wave=makeWave(plan.upgrades);
      if(tap)drawTap(wave,plan.remove[0]);
      plan.upgrades.forEach(up=>drawFormation(wave,up));
      if(conversion)drawConversion(wave,conversion,plan.effects);
      const converted=conversion && new Set(conversion.stripes.map(s=>s.pos));
      const icons=plan.effects.filter(e=>e.kind==="gold" && e.pos!==conversion?.goldPos);
      const sequence=goldSequence(icons,conversion ? salvoAt(0)+100 : 0);
      for(const icon of icons)drawGold(wave,icon,sequence,tiles);
      const lines=new Set();
      for(const {kind,pos,targets} of plan.effects){
        if(kind==="gold" || converted?.has(pos))continue;
        const line=kind+(kind==="row" ? Math.floor(pos/SIZE) : pos%SIZE);
        if(lines.has(line))continue;
        lines.add(line);
        if(conversion){
          // A collateral arrow follows the hit that reached its location,
          // without postponing the carefully spaced paid volleys or gravity.
          const start=Math.max(salvoAt(0)+80,(wave.impacts.get(pos)?.at || salvoAt(0))+80);
          drawStripe(wave,kind,pos,start-112,{travel:380,tail:280,targets});
        }else this.beam(kind,pos,wave,icons.length ? 135 : 0);
      }
      const playback=playWave(this.el,wave);
      if(playback)work.push(playback);else wave=null;
    }
    if(conversion){
      if(wave){
        for(const stripe of conversion.stripes){
          const tile=tiles[stripe.pos];tile.node.dataset.kind=stripe.kind;
          tile.art.replaceChildren(conversionBadge(stripe));
        }
      }else this.showStill(conversion.stripes);
    }
    this.showScores(scoredCells,wave?.hitAt);
    for(const {pos,code} of plan.upgrades)work.push(upgrade(tiles[pos],code,!!wave));
    for(const pos of plan.remove){
      const tile=tiles[pos],art=tile.art,hit=wave?.impacts.get(pos);
      art.style.opacity="0";art.style.transform=hit ? "scale(.52)" : "scale(.73)";
      const delay=wave?.hitAt.get(pos) || 0;
      let fade;
      if(staged && !wave)fade=Promise.resolve();
      else if(hit)fade=tween(art,[{opacity:1,transform:"scale(1)"},
        {opacity:1,transform:"translate("+hit.dx*4+"%,"+hit.dy*4+"%) scale(1.13)",offset:.24},
        {opacity:0,transform:"scale(.52)"}],142,"cubic-bezier(.22,.02,.62,1)",delay);
      else fade=tween(art,[{opacity:1,transform:"scale(1)"},{opacity:.95,transform:"scale(1.055)",offset:.28},
        {opacity:0,transform:"scale(.73)"}],160,"cubic-bezier(.32,0,.65,1)",delay);
      work.push(fade.then(()=>{
        tile.node.remove();tiles[pos]=null;
      }));
    }
    await Promise.all(work);
  }
  async fall(board,origins) {
    const previous=this.tiles, incoming=document.createDocumentFragment(), work=[];
    const maxDrop=Math.max(...origins.map((from,pos)=>Math.floor(pos/SIZE)-from));
    const duration=155+maxDrop*33;
    this.tiles=board.map((code,pos)=>{
      const [col,row]=point(pos),from=origins[pos];
      let tile;
      if(from<0){
        tile=createTile(code,col,from,this.menu);incoming.append(tile.node);
      } else tile=previous[from*SIZE+col];
      return tile;
    });
    this.el.append(incoming);
    this.tiles.forEach((tile,pos)=>{
      const action=moveTo(tile,...point(pos),duration,"cubic-bezier(.30,.02,.62,1)");
      if(action)work.push(action);
    });
    await Promise.all(work);
  }
  async shuffle(board) {
    const previous=this.tiles, available=new Map(), next=new Array(board.length), work=[];
    previous.forEach((tile,pos)=>{
      if(tile.code===board[pos]){next[pos]=tile;return;}
      if(!available.has(tile.code))available.set(tile.code,[]);
      available.get(tile.code).push(tile);
    });
    board.forEach((code,pos)=>{
      if(next[pos])return;
      let tile=available.get(code)?.pop();
      if(!tile){
        tile=createTile(code,...point(pos),this.menu);this.el.append(tile.node);
        work.push(tween(tile.art,[{opacity:0},{opacity:1}],240));
      }
      next[pos]=tile;
      const movement=moveTo(tile,...point(pos),330,"cubic-bezier(.32,.02,.32,1)");
      if(movement)work.push(movement);
    });
    for(const pool of available.values())for(const tile of pool){
      tile.art.style.opacity="0";
      work.push(tween(tile.art,[{opacity:1},{opacity:0}],170).then(()=>tile.node.remove()));
    }
    this.tiles=next;await Promise.all(work);
  }
}
