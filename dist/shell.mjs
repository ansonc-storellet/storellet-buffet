// Entry and result navigation. This preview never charges Storellet points.
const PLAY_KEY='storellet.buffet.preview.plays.v1';
const hkDay=ms=>new Date(ms+8*60*60*1000).toISOString().slice(0,10);
export class PreviewFlow {
  constructor(storage,now=()=>Date.now()){
    if(storage===undefined){try{storage=globalThis.localStorage;}catch{storage=null;}}
    this.storage=storage;this.now=now;this.screen='home';this.returnScreen='home';this.active=false;
    this.plays={day:hkDay(now()),used:0};
    try{const data=JSON.parse(storage?.getItem(PLAY_KEY));if(data?.day===this.plays.day&&Number.isSafeInteger(data.used)&&data.used>=0)this.plays=data;}catch{}
  }
  remainingFree(){
    if(this.plays.day!==hkDay(this.now()))this.plays={day:hkDay(this.now()),used:0};
    try{
      const saved=JSON.parse(this.storage?.getItem(PLAY_KEY));
      if(saved?.day===this.plays.day&&Number.isSafeInteger(saved.used)&&saved.used>this.plays.used)this.plays=saved;
    }catch{}
    return Math.max(0,3-this.plays.used);
  }
  start(){
    if(this.active||!['home','result'].includes(this.screen))return false;
    this.remainingFree();this.plays.used++;try{this.storage?.setItem(PLAY_KEY,JSON.stringify(this.plays));}catch{}
    this.active=true;this.screen='play';return true;
  }
  finish(){if(!this.active)return false;this.active=false;this.screen='result';return true;}
  home(){if(this.active)return false;this.screen='home';return true;}
  abandon(){this.active=false;this.screen='home';}
  leaderboard(){if(!['home','result'].includes(this.screen))return false;this.returnScreen=this.screen;this.screen='leaderboard';return true;}
  back(){if(this.screen==='leaderboard')this.screen=this.returnScreen;}
}

export function createShell({onStart,onHelp,onExit,getBest,storage,now=()=>Date.now()}){
  const $=id=>document.getElementById(id),flow=new PreviewFlow(storage,now);
  let midnightTimer,recordMessage="";
  const screens={home:$('homeScreen'),play:$('playScreen'),result:$('resultDialog'),leaderboard:$('leaderboardScreen')};
  const number=n=>Math.max(0,Number(n)||0).toLocaleString('en-US');
  function update(){
    $('homeFreeCount').textContent=flow.remainingFree();
    $('homeBest').textContent=getBest()?number(getBest()):'—';
    $('leaderBest').textContent=getBest()?number(getBest()):'—';
    $('leaderRound').hidden=flow.returnScreen!=='result';
    $('leaderRoundScore').textContent=$('finalScore').textContent;
    $('leaderRecord').textContent=flow.returnScreen==='result'?recordMessage:'';
    for(const id of ['finalScore','leaderRoundScore']){
      const el=$(id),length=el.textContent.length;
      el.style.fontSize=length>7?Math.max(18,Math.floor(400/length))+'px':'';
    }
    for(const id of ['finalHand','leaderBest']){
      const el=$(id),length=el.textContent.length;
      el.style.fontSize=length>8?Math.max(14,Math.floor(320/length))+'px':'';
    }
    document.querySelector('.result-records').classList.toggle('long-values',$('finalHand').textContent.length>9);
    document.querySelector('.leader-personal').classList.toggle('long-values',$('leaderBest').textContent.length>9);
    clearTimeout(midnightTimer);
    const shifted=now()+8*60*60*1000;
    midnightTimer=setTimeout(update,86400000-(shifted%86400000)+50);
  }
  function paint(focus=true){
    for(const [name,node] of Object.entries(screens)){node.hidden=name!==flow.screen;node.inert=name!==flow.screen;}
    $('phone').dataset.screen=flow.screen;update();
    if(focus){
      const target={home:'startGame',play:'helpButton',result:'resultTitle',leaderboard:'leaderTitle'}[flow.screen];
      $(target).focus({preventScroll:true});
    }
  }
  function start(){if(!flow.start())return;paint(false);onStart();}
  function home(){if(flow.home())paint();}
  function board(){if(flow.leaderboard())paint();}
  $('startGame').addEventListener('click',start);
  $('homeRules').addEventListener('click',()=>onHelp('home'));
  $('homeLeaderboard').addEventListener('click',board);
  $('resultAction').addEventListener('click',start);
  $('resultHome').addEventListener('click',home);
  $('resultLeaderboard').addEventListener('click',board);
  $('leaderBack').addEventListener('click',()=>{flow.back();paint(false);$(flow.screen==='home'?'homeLeaderboard':'resultLeaderboard').focus({preventScroll:true});});
  for(const id of ['homeTerms','leaderRewards'])$(id).addEventListener('click',()=>{
    $('campaignTitle').textContent=id==='homeTerms'?'活動條款及細則':'活動獎勵';
    $('campaignDialog').showModal();
  });
  for(const id of ['campaignClose','campaignDone'])$(id).addEventListener('click',()=>$('campaignDialog').close());
  $('quitCancel').addEventListener('click',()=>$('quitDialog').close());
  $('quitConfirm').addEventListener('click',()=>{
    $('quitDialog').close();onExit();flow.abandon();paint();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
  window.addEventListener('storage',update);
  paint(false);
  return {
    isPlaying:()=>flow.screen==='play',
    start,
    finish(message=""){if(!flow.finish())return;recordMessage=message;paint();},
    quit(){if(flow.active)$('quitDialog').showModal();},
    refresh:update
  };
}
