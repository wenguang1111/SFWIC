import { colors, line, poly, rect } from './pixels.js';
import { fighters } from './roster.js';
import { baseSkin, skins } from '../assets/skins.js';

const profiles = new Map(fighters.map(p => [p.id, p]));
const clamp = v => Math.min(1, Math.max(0, v));
const TAU = Math.PI * 2;

// ---- Move lookups shared by every renderer (read-only) -------------------------------

// The fighter's own profile wins over the roster, so a match keeps the data it started with.
export function currentMove(f) {
  if (f?.moveId == null) return null;
  return (f.profile ?? profiles.get(f.id))?.moves?.[f.moveId] ?? null;
}

// Frame data as { startup, active, recovery }; null when the move lacks usable timing.
export function frameData(m) {
  const [startup, active, recovery] = Array.isArray(m?.timing) ? m.timing : [m?.startup, m?.active, m?.recovery];
  return [startup, active, recovery].every(v => Number.isFinite(v) && v >= 0) ? { startup, active, recovery } : null;
}

// A skin may declare its own element (the skater's 'ice'); otherwise the silhouette's element.
export const themeOf = id => skins[id]?.effects ?? baseSkin(id);
const isKick = m => /^[bdk]$/.test(m?.input?.button ?? '');

// ---- Registries ------------------------------------------------------------------------
// A move effect is looked up by move.vfx, then the move id, then `${theme}.${kind}`, then
// `${theme}.${pose}`. Adding a move's effect therefore means registering one function.
const moveDrawers = new Map(), projectileDrawers = new Map();
export function registerEffect(key, draw) { moveDrawers.set(key, draw); }
export function registerProjectile(key, draw) { projectileDrawers.set(key, draw); }

function first(map, keys) {
  for (const key of keys) if (key != null && map.has(key)) return map.get(key);
  return null;
}

// ---- Pixel primitives --------------------------------------------------------------------
function spark(c,x,y,dx,dy,k,w=2){poly(c,k,[x,y-w,x+dx,y+dy,x,y+w,x-w,y]);}
function ring(c,x,y,rx,ry,k,phase=0){
  for(let n=0;n<10;n++){
    const a=phase+n*Math.PI/5,b=a+.43;
    line(c,k,x+rx*Math.cos(a),y+ry*Math.sin(a),x+rx*Math.cos(b),y+ry*Math.sin(b));
  }
}
// Polyline along an ellipse from angle `from` to `to`.
function arc(c,k,x,y,rx,ry,from,to,weight=1,steps=8){
  for(let n=0;n<steps;n++){
    const a=from+(to-from)*n/steps,b=from+(to-from)*(n+1)/steps;
    line(c,k,x+rx*Math.cos(a),y+ry*Math.sin(a),x+rx*Math.cos(b),y+ry*Math.sin(b),weight);
  }
}
function oval(c,k,x,y,rx,ry){
  const pts=[];
  for(let n=0;n<12;n++){const a=n*TAU/12;pts.push(x+rx*Math.cos(a),y+ry*Math.sin(a));}
  poly(c,k,pts);
}
function sparkle(c,x,y,size,k){line(c,k,x-size,y,x+size,y);line(c,k,x,y-size,x,y+size);}
// Six-armed snow crystal; ice art is crystals and arcs, never blades.
function crystal(c,x,y,r,k,core){
  for(let n=0;n<3;n++){
    const a=n*Math.PI/3,dx=Math.cos(a)*r,dy=Math.sin(a)*r;
    line(c,k,x-dx,y-dy,x+dx,y+dy);
    if(r>=4){const bx=dx*.6,by=dy*.6;sparkle(c,x+bx,y+by,1,k);sparkle(c,x-bx,y-by,1,k);}
  }
  rect(c,core,x-1,y-1,2,2);
}
// Front-lit spinning ring: the near half is brighter than the far half.
function orbit(c,x,y,rx,ry,phase,far,near){
  for(let n=0;n<12;n++){
    const a=phase+n*TAU/12,b=a+TAU/14;
    line(c,Math.sin(a)>0?near:far,x+rx*Math.cos(a),y+ry*Math.sin(a),x+rx*Math.cos(b),y+ry*Math.sin(b),Math.sin(a)>0?2:1);
  }
}
function flame(c,x,y,len,p,elapsed,embers){
  poly(c,'#bc4250',[x-len-5,y+2,x-len-18,y-9,x-len+5,y-5,x-len-4,y-12,x-9,y-6,x-3,y-9,x+3,y-4,x+9,y-3,x+6,y+2,x-1,y+6,x-len-1,y+8,x-len+6,y+3]);
  poly(c,p.clothHi,[x-len-4,y-5,x-9,y-3,x-13,y-8,x-1,y-4,x+6,y-2,x+3,y+3,x-4,y+5,x-len+4,y+6,x-11,y+2]);
  spark(c,x-4,y+1,9,-2,p.glow,3);
  for(let i=0;i<embers;i++){const xx=x-(i*13+elapsed*2)%(len+17), yy=y-9+(i*7)%21;line(c,i%2?p.trim:p.glow,xx,yy,xx-3-i%4,yy+1);}
}
// Vertical column of flickering diamonds rising from the floor.
function pillar(c,x,height,width,outer,inner,tick){
  const rows=Math.max(1,Math.floor(height/8));
  for(let n=0;n<rows;n++){
    const y=-n*8-(tick*2)%8, w=width*(1-n/(rows+1))+(n+tick)%2;
    poly(c,outer,[x-w,y,x-1,y-11,x+w,y,x,y+4]);
    poly(c,inner,[x-w*.5,y,x,y-7,x+w*.5,y,x,y+2]);
  }
}
function chips(c,x,y,count,spread,tick,k1,k2){
  for(let n=0;n<count;n++){
    const vx=((n*37)%11-5)*spread/5, vy=-3-(n*13)%5, age=tick*.5;
    rect(c,n%2?k1:k2,x+vx*age,y+vy*age+age*age*.35,2+n%2,2);
  }
}
function dust(c,x,y,size,tick,k){
  for(let n=0;n<5;n++){const r=size*(.5+n%3*.25)+tick*.4;oval(c,k,x+(n-2)*size*.7,y-r*.3,r*.6,r*.35);}
}

// ---- Move effect drawers, fighter-local coordinates with +X toward the opponent ----------
// e = { f, m, t, startup, active, recovery, elapsed, live, fade, reach, y, hits, hit, segT }

// ----- 烬: flame ------------------------------------------------------------------------
const jin = colors.jin;
// Sparks circling the chest while a special winds up.
function chargeSwirl(c,e,k){
  const r=4+(-e.elapsed)%13;
  for(let n=0;n<4;n++){const a=n*Math.PI/2+e.t*.13,x=4+Math.cos(a)*r*1.4,y=-35+Math.sin(a)*r;line(c,k,x,y,x+Math.cos(a)*3,y+Math.sin(a)*3);}
}
const jinCharge = (c,e) => chargeSwirl(c,e,jin.trim);
function emberFang(stage){
  return (c,e)=>{
    if(!e.live)return;
    const size=8+stage*5, x=e.reach-size*.4, y=e.y, dir=stage===2?1:-1;
    // Three parallel fire streaks bite through the target, alternating direction per stage.
    [jin.clothHi,jin.trim,jin.glow].forEach((k,n)=>arc(c,k,x-n*3,y+n*3*dir,size-n*2,(size-n*2)*.8*dir,-1.2,1,2));
    for(let i=0;i<3+stage*2;i++){const xx=x+((i*11+e.elapsed*3)%(size*2))-size,yy=y-dir*((i*7)%size);rect(c,i%2?jin.trim:jin.glow,xx,yy,2,1);}
    if(stage===3){ring(c,x+size*.6,y,6+e.elapsed*1.5,8+e.elapsed*2,jin.glow,e.t*.2);spark(c,x+size*.6,y,12,-3,jin.glow,4);}
  };
}
registerEffect('emberFang1',emberFang(1));
registerEffect('emberFang2',emberFang(2));
registerEffect('emberFang3',emberFang(3));
registerEffect('risingFlame',(c,e)=>{
  if(!e.live){for(let n=0;n<3;n++)rect(c,n%2?jin.trim:jin.glow,6+n*5,-2-(e.t+n*3)%7,2,1);return;}
  const h=80*clamp((e.elapsed+2)/Math.max(1,e.active));
  pillar(c,Math.max(10,e.reach*.45),h,8,jin.clothHi,jin.glow,e.t);
  spark(c,Math.max(10,e.reach*.45)+2,-h,3,-8,jin.glow,3);
});
const crimsonRush=(c,e)=>{
  if(!e.live){jinCharge(c,e);return;}
  flame(c,e.reach+6,e.y,46,jin,e.elapsed,9);
  for(let n=0;n<6;n++)rect(c,n%2?jin.trim:jin.clothHi,-48+n*8+(e.elapsed%4),-1-(n%2),3,1);
};
registerEffect('crimsonRush',crimsonRush);
registerEffect('stepKick',(c,e)=>{
  if(!e.live)return;
  pillar(c,e.reach*.55,18,5,jin.clothHi,jin.glow,e.t);
  flame(c,e.reach,e.y,10,jin,e.elapsed,3);
});
const skyBurn=(c,e)=>{
  if(!e.live){ring(c,2,-34,18,27,jin.trim,e.t*.2);ring(c,2,-34,14,22,jin.glow,-e.t*.17);jinCharge(c,e);return;}
  flame(c,e.reach+8,e.y,60,jin,e.elapsed,12);
  pillar(c,e.reach*.45,90,10,jin.clothHi,jin.glow,e.t);
  pillar(c,e.reach*.9,70,8,'#bc4250',jin.trim,e.t+3);
};
registerEffect('skyBurn',skyBurn);
registerEffect('jin.super',skyBurn);
registerEffect('jin.light',(c,e)=>{if(e.live)flame(c,e.reach,e.y,12,jin,e.elapsed,4);});
registerEffect('jin.heavy',(c,e)=>{if(e.live)flame(c,e.reach,e.y,21,jin,e.elapsed,4);});
registerEffect('jin.special',crimsonRush);
registerEffect('jin.throw',(c,e)=>{
  if(!e.live)return;
  const x=Math.min(30,e.reach*.6), r=3+e.elapsed*1.2;
  for(let n=0;n<8;n++){const a=n*TAU/8+.3;spark(c,x+Math.cos(a)*r,-40+Math.sin(a)*r,Math.cos(a)*5,Math.sin(a)*5,n%2?jin.trim:jin.glow,2);}
});
registerEffect('jin.defense',(c,e)=>{
  if(e.t>e.startup+e.active+4)return;
  for(let n=0;n<5;n++){const y=-10-n*9,x=12+(n*7+e.t)%12;line(c,n%2?jin.trim:jin.clothHi,x,y,x+7+n,y-1);}
});

// ----- 澜: water ------------------------------------------------------------------------
const lan = colors.lan;
function vortex(c,x,y,rx,ry,t){ring(c,x,y,rx,ry,lan.clothHi,t*.12);ring(c,x+1,y,rx*.84,ry*.8,lan.trim,-t*.13);}
function droplets(c,x,y,count,tick){
  for(let n=0;n<count;n++){const dx=((n*29)%13-6)*.6, a=tick*.5;rect(c,n%2?lan.trim:lan.glow,x+dx*a,y-4*a+a*a*.4+(n%3)*2,2,1+n%2);}
}
const tideBand=(c,e)=>{
  if(!e.live){chargeSwirl(c,e,lan.trim);return;}
  const x=e.reach,y=e.y;
  poly(c,lan.clothHi,[14,y+7,35,y-2,60,y-5,x-8,y-3,x,y-7,x-7,y+1,76,y+3,51,y+1,22,y+10]);
  poly(c,lan.glow,[20,y+6,43,y-2,68,y-4,x-7,y-2,x,y-6,x-5,y-1,66,y-2,44,y,24,y+6]);
  for(let i=0;i<8;i++)rect(c,lan.trim,20+(i*19+e.elapsed*2)%Math.max(20,x-20),y-12+(i*7)%25,2+i%3,1);
};
const tideChop=(scale)=>(c,e)=>{
  if(!e.live)return;
  const r=e.reach,y=e.y;
  poly(c,lan.clothHi,[10,-67*scale,26,-61*scale,39,-51*scale,r,y,r-4,y-1,36,-47*scale,24,-57*scale]);
  line(c,lan.glow,34,-51*scale,r-1,y);
  if(scale>1)droplets(c,r,y,6,e.elapsed);
};
registerEffect('lan.light',(c,e)=>{if(e.live){const y=e.y,r=e.reach;poly(c,lan.trim,[21,y+3,33,y,r-3,y,r+3,y-2,r,y+2,37,y+3,25,y+6]);}});
registerEffect('lan.heavy',tideChop(1));
registerEffect('lan.special',tideBand);
registerEffect('fallingTide',tideChop(1.15));
registerEffect('tideShot',(c,e)=>{
  if(!e.live){for(let n=0;n<4;n++){const a=n*TAU/4+e.t*.25,r=12-(e.t%12);rect(c,lan.glow,16+Math.cos(a)*r,-38+Math.sin(a)*r,2,2);}return;}
  ring(c,18,-38,4+e.elapsed*1.2,6+e.elapsed*1.6,lan.trim,e.t*.2);
  oval(c,lan.glow,18,-38,3,4);
});
registerEffect('tideRise',(c,e)=>{
  if(!e.live)return;
  const x=Math.max(10,e.reach*.4), h=80*clamp((e.elapsed+2)/Math.max(1,e.active));
  for(let n=0;n*7<h;n++){
    const y=-n*7, sway=Math.sin(n*.9+e.t*.4)*6;
    poly(c,n%2?lan.clothHi:lan.cloth,[x+sway-5,y,x+sway,y-8,x+sway+5,y,x+sway,y+3]);
    rect(c,lan.glow,x-sway-1,y-3,2,1);
  }
  droplets(c,x,-h,5,e.elapsed);
});
const surge=(c,e)=>{
  if(!e.live){vortex(c,6,-37,24,30,e.t);vortex(c,6,-37,14,18,-e.t);return;}
  const len=Math.min(Math.max(40,e.reach),24+e.elapsed*8), crest=-52;
  poly(c,lan.cloth,[8,0,len*.35,crest*.7,len*.7,crest,len,crest*.6,len+6,crest*.9,len-4,crest*.3,len,0]);
  poly(c,lan.clothHi,[16,0,len*.4,crest*.6,len*.7,crest*.88,len-2,crest*.55,len-6,0]);
  arc(c,lan.glow,len-6,crest*.75,8,8,-2.4,.6,2);
  droplets(c,len,crest,8,e.elapsed);
};
registerEffect('surge',surge);
registerEffect('lan.super',surge);
registerEffect('lan.throw',(c,e)=>{if(e.live)vortex(c,Math.min(30,e.reach*.6),-38,10+e.elapsed*.5,14+e.elapsed*.6,e.t);});
registerEffect('lan.defense',(c,e)=>{if(e.t<=e.startup+e.active+4)vortex(c,9,-37,19,24,e.t);});

// ----- 岳: earth -----------------------------------------------------------------------
const yue = colors.yue, rock = '#a57d51', rockDark = '#6b5238', dustK = '#8d7a62';
function spikes(c,e,extent,height){
  for(let i=0;i<6;i++){
    const x=13+(extent-13)*i/5, h=height*(1-i*.09), peak=x+5+i%3;
    poly(c,rock,[x-4,0,x,-5,peak,-h,x+5,-6,x+7,-3,x+12,0]);
    poly(c,yue.trim,[x-2,-1,x+1,-7,peak,-h,x+3,-6]);
    rect(c,yue.glow,peak+2,-h-3-(e.elapsed+i)%4,2,2);
  }
  line(c,yue.trim,12,-1,extent+8,-1);
}
function shock(c,x,tick){arc(c,yue.trim,x,-1,6+tick*2,2+tick*.4,Math.PI,TAU,1,10);arc(c,dustK,x,-1,3+tick*1.4,1+tick*.3,Math.PI,TAU,1,8);}
const yuePunch=(c,e)=>{if(e.live){spark(c,e.reach-6,e.y,12,-2,yue.trim,4);spark(c,e.reach-3,e.y,10,-1,yue.glow);}};
registerEffect('yue.light',yuePunch);
registerEffect('yue.heavy',(c,e)=>{
  if(!e.live)return;
  if(isKick(e.m)||e.m.level==='low')spikes(c,e,e.reach*clamp(.6+e.elapsed*.13),11);
  else{yuePunch(c,e);chips(c,e.reach,e.y,5,4,e.elapsed,rock,yue.trim);}
});
registerEffect('yue.special',(c,e)=>{
  if(!e.live){chargeSwirl(c,e,yue.trim);return;}
  spikes(c,e,e.reach*clamp(.6+e.elapsed*.13),23);
});
registerEffect('quake',(c,e)=>{
  if(!e.live)return;
  shock(c,16,e.elapsed);
  dust(c,14,-1,4,e.elapsed,dustK);
  spikes(c,e,30,8+e.elapsed%3);
});
registerEffect('landslideThrow',(c,e)=>{
  const x=Math.min(32,e.reach*.65);
  if(!e.live){dust(c,6,-1,2,e.t%6,dustK);return;}
  if(e.elapsed<e.active){spark(c,x,-40,6,-2,yue.glow,3);return;}
  const slam=e.elapsed-e.active;
  shock(c,x,slam);chips(c,x,-2,8,6,slam,rock,yue.trim);dust(c,x,-1,5,slam,dustK);
});
registerEffect('boulderStep',(c,e)=>{
  // Rock plates cover the front of the body while the armour holds.
  if(e.elapsed<e.active){
    poly(c,rockDark,[16,-62,26,-58,30,-40,28,-16,18,-8,22,-30,22,-48]);
    poly(c,rock,[18,-58,25,-55,28,-40,26,-20,21,-13,24,-30,24,-46]);
    line(c,yue.glow,24,-52,27,-40);line(c,yue.trim,27,-34,25,-22);
  }
  for(let n=0;n<4;n++)oval(c,dustK,-12-n*8-(e.t%4),-2-(n%2),3+n,2);
});
const heavenEarth=(c,e)=>{
  if(!e.live){chargeSwirl(c,e,yue.glow);dust(c,0,-1,4,e.t%8,dustK);return;}
  const x=Math.min(36,e.reach*.6), h=90*clamp((e.elapsed+2)/Math.max(4,e.active));
  for(let n=0;n*10<h;n++){const w=12-n%3*2;poly(c,n%2?rock:rockDark,[x-w,-n*10,x-w+2,-n*10-11,x+w-1,-n*10-9,x+w,-n*10]);rect(c,yue.trim,x-w+3,-n*10-9,w,1);}
  chips(c,x,-h,10,8,e.elapsed,rock,yue.glow);
  shock(c,x,e.elapsed);dust(c,x,-1,6,e.elapsed,dustK);
};
registerEffect('heavenEarth',heavenEarth);
registerEffect('yue.super',heavenEarth);
registerEffect('yue.throw',(c,e)=>{if(e.live){const x=Math.min(30,e.reach*.6);dust(c,x,-1,4,e.elapsed,dustK);chips(c,x,-2,5,4,e.elapsed,rock,yue.trim);}});
registerEffect('yue.defense',(c,e)=>{
  if(e.t>e.startup+e.active+4)return;
  poly(c,'#ac8055',[17,-57,23,-54,27,-40,25,-22,19,-15,23,-29,24,-41]);line(c,yue.glow,23,-51,26,-40);line(c,yue.trim,25,-36,24,-25);
  for(let n=0;n<3;n++){const y=-15-(n*14+e.t)%34;rect(c,yue.trim,19+n*3,y,2,2);}
});

// Built-in silhouettes show a held guard with a glint on the lead forearm.
for(const id of ['jin','lan','yue'])registerEffect(`${id}.guard`,(c)=>line(c,colors[id].trim,16,-56,21,-43));

// ----- 冰上少女: ice crystals and spin arcs; skates stay tools for gliding -----------------
const ice = { frost:'#d9f2ff', blue:'#8fc8ff', violet:'#b6a3ff', white:'#ffffff' };
function iceSpray(c,x,tick,count=6){
  for(let n=0;n<count;n++){const dx=((n*17)%9-4)*(1+tick*.15),y=-1-(n*5+tick)%7;rect(c,n%2?ice.frost:ice.blue,x+dx,y,2,1);}
}
const iceLight=(c,e)=>{if(e.live){sparkle(c,e.reach-4,e.y,3,ice.white);sparkle(c,e.reach-8,e.y+4,2,ice.blue);}};
const iceKickArc=(c,e)=>{
  if(!e.live)return;
  // Half-ring traced by the spinning kick, at kick height.
  for(let n=0;n<8;n++){const a=-Math.PI/2+n*Math.PI/8,b=a+Math.PI/10;
    line(c,n%2?ice.violet:ice.frost,8+e.reach*.55*Math.cos(a),e.y+20*Math.sin(a),8+e.reach*.55*Math.cos(b),e.y+20*Math.sin(b));}
  sparkle(c,e.reach-6,e.y-2,3,ice.white);
};
const iceArc=(c,e)=>{
  if(!e.live){for(let n=0;n<3;n++)sparkle(c,-6+n*7,-30-(e.t+n*5)%18,1+n%2,ice.frost);return;}
  // Long arc scraped into the ice behind the lunge, ending in a palm flash.
  line(c,ice.blue,-70,0,0,-1);line(c,ice.frost,-60,-1,0,-2);
  for(let n=0;n<6;n++)rect(c,ice.frost,-60+n*11+(e.elapsed%4),-3-(n%3),2,1);
  sparkle(c,e.reach-4,e.y,4,ice.white);sparkle(c,e.reach-10,e.y+6,2,ice.violet);
};
registerEffect('ice.light',(c,e)=>isKick(e.m)?iceKickArc(c,e):iceLight(c,e));
registerEffect('ice.heavy',(c,e)=>isKick(e.m)?iceKickArc(c,e):iceArcPalm(c,e));
function iceArcPalm(c,e){if(e.live){crystal(c,e.reach-4,e.y,5,ice.frost,ice.white);sparkle(c,e.reach-10,e.y+5,2,ice.violet);}}
registerEffect('ice.special',iceArc);
registerEffect('iceArc',iceArc);
registerEffect('spinChain',(c,e)=>{
  if(!e.live){orbit(c,0,-2,10,3,e.t*.4,ice.blue,ice.frost);return;}
  const rx=Math.max(14,e.reach*.55), phase=(e.hit+e.segT)*TAU;
  orbit(c,4,e.y,rx,9,phase,ice.violet,ice.frost);
  if(e.hit>0)orbit(c,4,e.y+6,rx*.8,7,phase-1.2,ice.blue,ice.violet);
  const kx=4+rx*Math.cos(phase), ky=e.y+9*Math.sin(phase);
  sparkle(c,kx,ky,3,ice.white);iceSpray(c,0,e.elapsed);
});
registerEffect('axel',(c,e)=>{
  if(!e.live){iceSpray(c,4,e.t,4);return;}
  // A helix of rings climbing from the ice to the kick, like the take-off of a jump.
  const rise=clamp((e.elapsed+2)/Math.max(1,e.active));
  for(let n=0;n<3;n++)orbit(c,4,-12-n*18*rise,12-n*2,4,e.t*.5+n,ice.blue,n===2?ice.white:ice.frost);
  crystal(c,Math.max(12,e.reach*.45),e.y,4,ice.frost,ice.white);
  for(let n=0;n<4;n++)rect(c,ice.frost,2+n%2*4,-n*10-(e.t%10),1,3);
});
registerEffect('sitSpin',(c,e)=>{
  if(!e.live){iceSpray(c,0,e.t,3);return;}
  const rx=Math.max(16,e.reach*.6);
  orbit(c,2,-6,rx,4,e.t*.6,ice.blue,ice.frost);orbit(c,2,-4,rx*.7,3,-e.t*.5,ice.violet,ice.white);
  iceSpray(c,rx*.6,e.elapsed,8);iceSpray(c,-rx*.6,e.elapsed,5);
});
const tripleAxel=(c,e)=>{
  if(!e.live){
    // Crystals gather around her during the dark-out before the jump.
    const r=8+Math.max(0,e.startup-e.t)*1.2;
    for(let n=0;n<6;n++){const a=n*TAU/6+e.t*.15;crystal(c,Math.cos(a)*r,-36+Math.sin(a)*r*.8,3,ice.frost,ice.white);}
    return;
  }
  const rx=Math.max(16,e.reach*.55);
  for(let n=0;n<=e.hit;n++)orbit(c,4,-14-n*14,rx-n*2,5,(e.segT+n)*TAU,n%2?ice.violet:ice.blue,ice.frost);
  crystal(c,e.reach-6,e.y,6+e.hit,ice.frost,ice.white);
  for(let n=0;n<6;n++){const a=n*1.7+e.elapsed*.2,r=10+e.elapsed*1.5;sparkle(c,4+Math.cos(a)*r,-40+Math.sin(a)*r*.7,n%2+1,n%2?ice.violet:ice.white);}
};
registerEffect('tripleAxel',tripleAxel);
registerEffect('ice.super',tripleAxel);
registerEffect('ice.throw',(c,e)=>{
  if(!e.live)return;
  const x=Math.min(30,e.reach*.6);
  orbit(c,x,-40,12,20,e.t*.4,ice.blue,ice.frost);sparkle(c,x,-62,2,ice.white);
});
registerEffect('ice.defense',(c,e)=>{
  if(e.t>e.startup+e.active+4)return;
  // Braking spray is thrown forward while the body slides backward.
  for(let n=0;n<7;n++){const x=6+n*4+(e.t%3),y=-1-(n*5+e.t)%9;rect(c,n%2?ice.frost:ice.blue,x,y,2,1);}
  line(c,ice.frost,-22,-1,6,-1);
});

// Hit height in local pixels: upper part of the move's band, or a body-height default.
function hitHeight(m,pose){
  const band=m?.band;
  if(Array.isArray(band)&&band.every(Number.isFinite))return -(band[0]+(band[1]-band[0])*.6)/2;
  return pose==='crouch'?-20:-38;
}

export function moveEffects(c,f) {
  const theme=themeOf(f.id), m=currentMove(f), fd=frameData(m), t=f.poseTick||0;
  if(!m||!fd){
    const idle=moveDrawers.get(`${theme}.${f.pose}`);
    if(idle&&f.pose==='guard')idle(c,{f,t});
    return;
  }
  const draw=first(moveDrawers,[m.vfx,f.moveId,`${theme}.${m.kind}`,`${theme}.${f.pose}`]);
  if(!draw)return;
  // Throws keep their slam visible longer than strikes keep their trail.
  const tail=m.level==='throw'||m.kind==='throw'?20:8;
  const elapsed=t-fd.startup, fade=1-clamp((elapsed-fd.active)/tail);
  if(fade<=0)return;
  const hits=Math.max(1,m.hits|0), seg=Math.max(1,fd.active)/hits, inActive=Math.max(0,Math.min(elapsed,fd.active-1e-3));
  const hit=Math.min(hits-1,Math.floor(inActive/seg));
  const e={f,m,t,...fd,elapsed,live:elapsed>=0,fade,reach:(m.reach??80)/2,y:hitHeight(m,f.pose),hits,hit,segT:clamp((inActive-hit*seg)/seg)};
  c.save();
  if(e.live&&fade<1)c.globalAlpha=Math.max(.25,fade);
  draw(c,e);
  c.restore();
}

// ---- Projectiles, drawn with the origin at the bottom-centre and +X along travel --------
registerProjectile('tideShot',(c,p)=>{
  const {w,h,age}=p, y=-h/2, rx=Math.max(4,w/2), ry=Math.max(4,h/2);
  for(let n=0;n<4;n++)rect(c,n%2?lan.trim:lan.glow,-rx-4-n*5-(age%5),y-3+(n*5)%9,2+n%2,1);
  oval(c,lan.cloth,0,y,rx,ry);oval(c,lan.clothHi,1,y,rx*.75,ry*.75);oval(c,lan.glow,2,y-1,rx*.35,ry*.35);
  arc(c,lan.glow,0,y,rx,ry,-1.2+age*.3,.2+age*.3,1,5);
});
registerProjectile('quake',(c,p)=>{
  const {w,h,age}=p, half=Math.max(8,w/2), top=Math.max(10,h);
  for(let i=0;i<4;i++){
    const x=-half+i*half*.66, rise=(Math.sin(age*.5-i)+1)/2, hh=top*(.4+.6*rise), peak=x+3;
    poly(c,rock,[x-4,0,x,-4,peak,-hh,x+4,-5,x+6,0]);poly(c,yue.trim,[x-2,-1,x,-5,peak,-hh,x+2,-4]);
  }
  dust(c,-half,-1,3,age%10,dustK);chips(c,half*.6,-2,3,3,age%8,rock,yue.glow);
});
registerProjectile('jin.projectile',(c,p)=>flame(c,Math.max(4,p.w/2),-Math.max(8,p.h/2),Math.max(14,p.w),jin,p.age,5));
registerProjectile('lan.projectile',projectileDrawers.get('tideShot'));
registerProjectile('yue.projectile',projectileDrawers.get('quake'));
registerProjectile('ice.projectile',(c,p)=>{
  const y=-Math.max(8,p.h/2), r=Math.max(5,Math.min(p.w,p.h)/2);
  crystal(c,0,y,r,ice.frost,ice.white);
  for(let n=0;n<4;n++)sparkle(c,-r-4-n*5,y+(n%2?3:-3),1,n%2?ice.violet:ice.blue);
});

export function drawProjectile(c,p,ownerId){
  const draw=first(projectileDrawers,[p.vfx,p.moveId,`${themeOf(ownerId)}.projectile`]);
  if(!draw)return;
  draw(c,{p,age:p.age||0,w:(Number.isFinite(p.w)?p.w:24)/2,h:(Number.isFinite(p.h)?p.h:24)/2});
}

// ---- Impacts -----------------------------------------------------------------------------
const SPARK_SCALE = { light:.7, heavy:1, special:1.25, super:1.6, throw:1.1 };
const ACCENT = { jin:'#ffad67', lan:'#7fe6d0', yue:'#efc266', ice:'#bfe3ff' };

export function impact(c,event,x,y,theme) {
  const age=event.age||0, progress=clamp(age/16), type=event.type;
  if(progress>=1||!['hit','block','throw','clash'].includes(type))return;
  const scale=type==='clash'?1.4:SPARK_SCALE[event.move]??1;
  c.save();c.translate(Math.round(x),Math.round(y));c.globalAlpha=1-progress;
  if(type==='throw'){
    dust(c,0,0,4*scale,age,dustK);
    ring(c,0,-4,6+progress*16,3+progress*6,ACCENT[theme]??'#ffad67',progress);
    c.restore();return;
  }
  const block=type==='block', clash=type==='clash';
  const k=block?'#9ae8e2':clash?'#ffe58a':ACCENT[theme]??'#ffad67', white=block?'#e0ffed':'#fff1c3';
  if(block){ring(c,0,0,5+progress*14,8+progress*16,k,progress*.6);ring(c,0,0,3+progress*8,6+progress*13,white,progress*.5);}
  else if(age<5){
    const s=scale, star=[0,-10,2,-3,10,-6,6,-1,13,1,4,3,6,10,1,5,-2,13,-4,3,-12,5,-5,0,-11,-5,-3,-3];
    poly(c,white,star.map(v=>v*s));
    if(clash)ring(c,0,0,8+age*3,8+age*3,k,age*.3);
  }
  const count=block?6:Math.round(7+scale*3);
  for(let i=0;i<count;i++){
    const a=i*2.37+(event.target?0:.7), dx=Math.cos(a),dy=Math.sin(a),r=(4+progress*(block?17:27))*(block?1:scale);
    spark(c,dx*r,dy*r,dx*(4+(i%3)*3)*scale,dy*(4+i%4)*scale,i%3?k:white,(1.6-progress)*Math.min(1.4,scale));
  }c.restore();
}
