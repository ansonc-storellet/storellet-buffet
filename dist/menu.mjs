// Original art uses the fifteen-item atlas; new/revised dishes use standalone art.
// Board codes stay 0–5, with exactly one dish per color family in each round.
const entry=(id,name,unit,category,family,artIndex,temperature='ambient',shortName=name,image=null)=>
  Object.freeze({id,name,shortName,unit,category,family,artIndex,temperature,image});
export const FOODS=Object.freeze({
  lobster:entry('lobster','龍蝦','隻','food','red',0,'hot'),
  punch:entry('punch','雜果賓治','杯','drink','red',1,'cold'),
  cola:entry('cola','可樂','杯','drink','red',2,'cold'),
  tempura:entry('tempura','蝦天婦羅','件','food','yellow',3,'hot'),
  pudding:entry('pudding','芒果布甸','個','food','yellow',4,'cold'),
  waffle:entry('waffle','格仔餅','件','food','yellow',5,'hot'),
  ramen:entry('ramen','日式拉麵','碗','food','yellow',6,'hot'),
  tea:entry('tea','綠茶','杯','drink','green',7,'hot'),
  lime:entry('lime','青檸梳打','杯','drink','green',8,'cold'),
  icecream:entry('icecream','雙色雪糕','杯','food','pink',9,'cold'),
  steak:entry('steak','牛扒','塊','food','brown',10,'hot'),
  turkey:entry('turkey','燒雞','份','food','brown',11,'hot','燒雞','assets/roast-chicken.webp'),
  chocolate:entry('chocolate','朱古力','塊','food','brown',12),
  coffee:entry('coffee','咖啡','杯','drink','brown',13,'hot'),
  oyster:entry('oyster','生蠔','隻','food','neutral',14,'cold'),
  bao:entry('bao','小籠包','隻','food','neutral',null,'hot','小籠包','assets/xiaolongbao.webp')
});

export const MENU=Object.freeze(['lobster','tea','tempura','icecream','oyster','steak'].map(id=>FOODS[id]));
const choose=(items,random)=>FOODS[items[Math.floor(random()*items.length)]];
export function drawMenu(random=Math.random){
  const red=choose(['lobster','punch','cola'],random);
  const green=choose(['tea','lime'],random);
  const yellow=choose(['tempura','pudding','waffle','ramen'],random);
  const brown=choose(red.category==='food'?['steak','turkey','chocolate','coffee']:['steak','turkey','chocolate'],random);
  const neutral=choose(['oyster','bao'],random);
  return Object.freeze([red,green,yellow,FOODS.icecream,neutral,brown]);
}
