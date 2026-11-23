import { colors, poly, panels, rect, line } from './pixels.js';
import { baseSkin } from '../assets/skins.js';
import { currentMove, frameData } from './effects.js';

const heads = {
  jin: [
    ['ink',-8,-10,-9,-15,-6,-16,-8,-18,-2,-18,0,-21,2,-19,8,-21,7,-18,12,-18,10,-13,9,-8,11,-6,9,-5,8,-1,4,1,0,0,-4,-3,-7,-4],
    ['skin',-6,-10,-2,-15,5,-16,8,-13,7,-9,9,-6,7,-5,6,-2,3,-1,-2,-4,-4,-7,-5,-5,-7,-8],
    ['mid',-5,-9,-2,-8,-1,-4,3,-1,0,-1,-4,-3],['light',1,-10,5,-11,7,-10,5,-8,1,-8],
    ['ink',0,-11,3,-11,7,-10,6,-9,2,-10],['ink',6,-5,9,-6,8,-4,5,-4],
    ['hair',-8,-12,-6,-15,-7,-17,-2,-17,0,-19,2,-18,7,-19,6,-16,10,-17,8,-13,3,-12,0,-11,-4,-8,-5,-6],
    ['hairHi',-7,-15,-2,-17,1,-18,-1,-15,6,-18,4,-15,8,-16,5,-13,0,-13,-4,-11,-2,-14],
    ['clothHi',-8,-11,-1,-14,8,-15,7,-13,-1,-12,-6,-9],
  ],
  lan: [
    ['ink',-9,-13,-6,-18,0,-21,6,-20,10,-17,12,-13,10,-8,9,-5,7,-1,3,1,-1,-1,-6,-4,-9,-2,-8,-7,-10,-5],
    ['skin',-3,-13,2,-17,8,-16,9,-11,8,-9,10,-7,8,-6,7,-3,4,-1,1,-2,-4,-6],
    ['light',2,-10,7,-12,8,-11,6,-9,3,-8],['ink',1,-11,6,-13,8,-13,7,-11,2,-10],['shade',6,-5,9,-6,8,-4,6,-4],
    ['hair',-9,-10,-8,-15,-5,-18,1,-20,6,-19,10,-16,11,-13,7,-14,2,-10,4,-14,-1,-9,-1,-6,-4,-3,-4,-7,-8,-3],
    ['hairMid',-8,-12,-6,-17,-1,-19,5,-19,9,-16,5,-16,2,-14,-4,-10,-2,-14],
    ['hairHi',-6,-15,-3,-18,2,-19,4,-18,0,-17,-3,-14],['trim',-8,-10,-4,-12,-4,-11,-8,-8],
  ],
  yue: [
    ['ink',-9,-11,-10,-16,-7,-18,-5,-20,0,-19,4,-21,9,-19,12,-16,11,-12,10,-9,12,-7,11,-4,9,-1,6,1,1,1,-4,-1,-7,-5,-10,-6],
    ['mid',-8,-11,-4,-14,4,-16,9,-15,9,-9,11,-7,9,-4,7,-2,1,-2,-4,-5,-4,-8,-7,-6],
    ['skin',-4,-12,1,-15,8,-15,9,-11,6,-11,5,-9,1,-8,-2,-8],['light',2,-15,8,-15,8,-13,4,-12],
    ['ink',-2,-11,3,-12,6,-11,5,-10,0,-10],['glow',1,-9,5,-10,4,-9,1,-8],['skin',6,-10,8,-11,8,-8,10,-7,7,-7],
    ['hair',-5,-7,-2,-7,1,-4,4,-5,10,-6,9,-2,5,0,1,-1,-4,-3],['skin',4,-4,8,-5,7,-3,4,-3],
    ['hair',-8,-12,-9,-15,-6,-17,-4,-19,1,-18,5,-20,9,-18,10,-16,7,-15,2,-15,-3,-13,-5,-10],
    ['hairMid',-7,-15,-4,-17,0,-17,-1,-15,5,-18,8,-17,3,-15,-3,-14],['hairHi',-8,-13,-4,-15,-2,-15,-6,-12],
  ],
};

// Limb sections taper between two articulated joints. The upper-left highlight
// stays coherent whether a forearm is vertical, swung down or fully extended.
function section(c,a,b,wa,wb,outline,base,hi) {
  const x=b[0]-a[0], y=b[1]-a[1], len=Math.hypot(x,y)||1;
  let nx=-y/len, ny=x/len;
  if(nx+ny>0){nx=-nx;ny=-ny;}
  function quad(start,end,color){poly(c,color,[a[0]+nx*wa*start,a[1]+ny*wa*start,b[0]+nx*wb*start,b[1]+ny*wb*start,b[0]+nx*wb*end,b[1]+ny*wb*end,a[0]+nx*wa*end,a[1]+ny*wa*end]);}
  quad(1,-1,outline);quad(.76,-.72,base);quad(.73,.29,hi);
}
const at = (x,y,q) => [x+q[0],y+q[1]];
const mix = (a,b,t) => a+(b-a)*t;
const shift = (arr,b,t) => {arr[0]=mix(arr[0],b[0],t);arr[1]=mix(arr[1],b[1],t);};
const clamp = x=>Math.max(0,Math.min(1,x));

function skeleton(f) {
  const pose=f.pose,id=baseSkin(f.id),t=f.poseTick||0, heavy=id==='yue', swift=id==='lan';
  const pace=Math.sin(t*.17), breath=Math.floor(t/13)%2;
  let hipX=0,hipY=heavy?-24:-26,shoulderX=2,neckY=heavy?-20:-23;
  const backK=[-13,-15],backF=[-18,-3],frontK=[12,-17],frontF=[10,-3];
  // Elbows and fists are relative to the shoulder centre.
  const backE=[8,8], backH=[16,-3],frontE=[-3,13],frontH=[9,3];
  let impulse=0,charge=0,move=null;
  if(pose==='walk') {hipY+=Math.round(Math.abs(pace)*2);backF[0]+=pace*9;frontF[0]-=pace*9;backF[1]-=Math.max(0,pace)*4;frontF[1]-=Math.max(0,-pace)*4;backK[0]+=pace*5;frontK[0]-=pace*5;frontH[0]+=pace*3;}
  else if(pose==='idle'){hipY+=breath;backH[1]-=breath;frontH[1]+=breath;}
  if(pose==='jump'){hipY=-26;backF.splice(0,2,-14,-17);backK.splice(0,2,-17,-28);frontK.splice(0,2,14,-28);frontF.splice(0,2,9,-16);frontH[1]=-9;backH[0]=11;}
  if(pose==='crouch'||(pose==='guard'&&f.crouched)){hipY=-15;neckY=-18;shoulderX=5;backK.splice(0,2,-16,-9);backF[0]=-20;frontK.splice(0,2,14,-17);frontF[0]=10;}
  if(pose==='guard'||pose==='defense'){shoulderX=-2;hipY+=2;backE.splice(0,2,10,6);backH.splice(0,2,15,-12);frontE.splice(0,2,1,7);frontH.splice(0,2,9,-10);if(pose==='defense'&&swift){backH[0]=19;frontH[1]=-16;}if(pose==='defense'&&id==='jin'){shoulderX=-7;backF[0]-=5;frontK[0]+=4;}}
  if(pose==='hurt'){shoulderX=-8;hipY+=2;backH.splice(0,2,13,-7);frontE.splice(0,2,-10,3);frontH.splice(0,2,-15,-6);}
  const m=currentMove(f), fd=frameData(m);
  if(fd&&(pose==='light'||pose==='heavy'||pose==='special')) {
    move=m;
    const {startup:s,active:a,recovery:r}=fd, reach=(m.reach??80)/2, button=m.input?.button??'';
    const kick=/^[bdk]$/.test(button), grab=m.level==='throw'||m.kind==='throw';
    const rising=m.input?.motion==='623'||m.input?.motion==='[2]8';
    const low=f.crouched||m.input?.stance==='crouch', air=!low&&(f.y>0||m.input?.stance==='air');
    impulse=t<s?clamp((t-s+3)/3):t<s+a?1:clamp(1-(t-s-a)/(Math.max(1,r)*.66));
    charge=t<s?Math.sin(t/Math.max(1,s)*Math.PI):0;
    // Crouching and airborne attacks start from the crouch / jump stance, then reach out.
    if(low){hipY=-15;neckY=-18;shoulderX=5;backK.splice(0,2,-16,-9);backF[0]=-20;frontK.splice(0,2,14,-17);frontF[0]=10;}
    if(air){backF.splice(0,2,-14,-17);backK.splice(0,2,-17,-28);frontK.splice(0,2,14,-28);frontF.splice(0,2,9,-16);}
    shoulderX-=charge*5;hipY+=charge*3;frontE[0]-=charge*5;frontH[0]-=charge*6;
    shoulderX+=impulse*(swift?5:8);hipY+=impulse*(low?1:2);
    if(grab){
      // Both hands seize, then haul the opponent up and over during recovery.
      const toss=t>=s+a?clamp((t-s-a)/(Math.max(1,r)*.5)):0, hand=Math.min(30,reach*.7);
      shift(frontE,[10,2],impulse);shift(frontH,[hand,-4],impulse);shift(backE,[10,4],impulse);shift(backH,[hand-4,-1],impulse);
      shift(frontH,[-4,-20],toss);shift(backH,[-8,-14],toss);shoulderX-=toss*10;hipY+=toss*3;
    } else if(rising&&kick){
      shoulderX-=impulse*10;shift(frontK,[12,-34],impulse);shift(frontF,[Math.min(28,reach*.4),-54],impulse);shift(frontH,[2,-9],impulse);
    } else if(rising){
      hipY-=impulse*3;shift(frontE,[4,-12],impulse);shift(frontH,[8,-32],impulse);shift(backH,[-6,4],impulse);
    } else if(kick&&low){
      // Sweep: the front leg slides out along the floor.
      shoulderX-=impulse*8;shift(frontK,[reach*.45,-7],impulse);shift(frontF,[reach-4,-3],impulse);
    } else if(kick&&air){
      shift(frontK,[reach*.5,-24],impulse);shift(frontF,[reach-6,-16],impulse);
    } else if(kick&&heavy){
      // Yue's kicks are stamps that drive force into the ground.
      hipY+=impulse*(pose==='special'?13:5);neckY+=impulse*4;shift(frontK,[17,-24],charge);shift(frontF,[15,-16],charge);shift(frontF,[23,-3],impulse);
      shift(frontH,[1,-16],charge);shift(frontE,[-9,-5],charge);shift(frontE,[5,8],impulse);shift(frontH,[17,16],impulse);shift(backH,[18,5],impulse);
    } else if(kick){
      const sweep=m.level==='low';
      shoulderX-=impulse*13;hipX-=impulse*2;
      shift(frontK,[reach*.54,sweep?-15:-36],impulse);shift(frontF,[reach-6,sweep?-8:-34],impulse);
      shift(frontH,[2,-9],impulse);shift(backH,[-14,3],impulse);backF[0]-=impulse*4;
    } else {
      // Overheads chop down from above; other punches drive straight out.
      const chop=m.level==='overhead';
      if(chop){shift(frontH,[6,-20],charge);shift(frontE,[-6,-9],charge);}
      const h=Math.min(40,reach-9);
      shift(frontE,[h*.48,chop?0:3],impulse);shift(frontH,[h,chop?12:air?6:0],impulse);
      shift(backE,[-8,9],impulse);shift(backH,[1,1],impulse);
      if(!air){frontF[0]+=impulse*4;backF[0]-=impulse*3;}
    }
  }
  return {hipX,hipY,shoulderX,neckY,backK,backF,frontK,frontF,backE,backH,frontE,frontH,impulse,charge,move};
}

function leg(c,id,p,hip,knee,foot,far) {
  const strong=id==='yue', slim=id==='lan';
  const pants=far?p.dark:slim?p.cloth:'#444251', seam=far?'#444452':slim?p.clothHi:'#65606b';
  section(c,hip,knee,strong?8:6,strong?6:4,p.ink,pants,seam);
  section(c,knee,foot,strong?6:4,3.5,p.ink,pants,seam);
  const [kx,ky]=knee,[x,y]=foot;
  if(strong){poly(c,far?p.cloth:p.clothHi,[kx-5,ky-3,kx+3,ky-5,kx+5,ky-1,kx+3,ky+3,kx-4,ky+3]);rect(c,p.trim,kx-2,ky-3,4,1);}
  poly(c,p.ink,[x-4,y-4,x+2,y-4,x+5,y-1,x+9,y,x+9,y+3,x-5,y+3]);
  poly(c,far?p.dark:p.hairMid,[x-3,y-3,x+1,y-3,x+4,y,x+7,y+1,x-3,y+1]);
  rect(c,far?p.shade:p.trim,x-3,y-3,5,1);
}

function arm(c,id,p,root,elbow,hand,far) {
  const strong=id==='yue', slim=id==='lan',a=at(...root,elbow),b=at(...root,hand);
  const sleeve=far?p.shade:strong?p.clothHi:p.cloth, light=far?p.mid:strong?p.trim:p.clothHi;
  section(c,root,a,strong?7:4.5,strong?5:3.5,p.ink,sleeve,light);
  section(c,a,b,strong?5:3.5,strong?4:2.7,p.ink,far?p.shade:p.mid,far?p.mid:p.skin);
  const [x,y]=b,w=strong?5:slim?2:3;
  poly(c,p.ink,[x-w-1,y-1,x-w+1,y-5,x+w,y-5,x+w+2,y-2,x+w+1,y+2,x-w+1,y+3]);
  poly(c,strong?p.clothHi:slim?p.skin:p.clothHi,[x-w,y-1,x-w+1,y-4,x+w,y-4,x+w+1,y-1,x+w,y+1,x-w+1,y+1]);
  rect(c,far?light:p.glow,x-w+1,y-4,Math.max(2,w),1);
  if(strong) rect(c,p.dark,x-3,y-1,6,1);
}

function body(c,id,p,s) {
  const {hipX:x,hipY:y,shoulderX:lean,neckY:ny}=s, wide=id==='yue'?13:id==='lan'?7:9;
  const shoulder=[x+lean,y+ny+2], hip=[x,y], neck=[x+lean+2,y+ny-1];
  leg(c,id,p,[x-4,y],s.backK,s.backF,true);
  arm(c,id,p,[shoulder[0]+4,shoulder[1]],s.backE,s.backH,true);
  leg(c,id,p,[x+2,y],s.frontK,s.frontF,false);
  const X=shoulder[0], Y=shoulder[1];
  poly(c,p.ink,[x-7,y+2,X-wide,Y+4,X-wide+2,Y-2,X-2,Y-4,X+wide-2,Y-2,X+wide,Y+4,x+7,y,x+6,y+4]);
  poly(c,p.cloth,[x-5,y+1,X-wide+2,Y+4,X-wide+4,Y-1,X-1,Y-2,X+wide-3,Y-1,X+wide-1,Y+4,x+5,y+1]);
  poly(c,p.dark,[X-3,Y,X+3,Y+4,X+wide-2,Y+2,x+4,y-1,x-3,y-2]);
  poly(c,p.clothHi,[X-wide+2,Y+3,X-wide+4,Y-1,X-3,Y-1,X-5,Y+4,x-5,y-2,x-7,y-3]);
  rect(c,p.ink,x-6,y-2,13,3);rect(c,p.trim,x+2,y-2,3,2);
  if(id==='lan'){
    poly(c,p.cloth,[X+5,Y,X+1,Y+7,X-6,Y+4,X-12,Y+5,X-18,Y+2,X-24,Y+4,X-18,Y,X-11,Y+2,X-6,Y+1]);
    poly(c,p.trim,[X-20,Y+2,X-16,Y,X-10,Y+1,X-6,Y,X,Y+2,X+5,Y-1,X+4,Y+2,X,Y+4,X-6,Y+2,X-10,Y+3]);
    line(c,p.trim,X+6,Y+6,x-3,y-4);
  } else if(id==='jin'){
    poly(c,p.clothHi,[X-9,Y-4,X-1,Y-2,X+3,Y+3,X+8,Y-2,X+7,Y+3,X+2,Y+8,X-4,Y+3]);
    line(c,p.trim,X-7,Y-3,X-1,Y);line(c,p.hairMid,X+3,Y+8,x+3,y-4);
  } else {
    poly(c,p.clothHi,[X-13,Y+2,X-10,Y-3,X-4,Y-3,X,Y+2,X-1,Y+6,X-10,Y+9,X-14,Y+6]);line(c,p.trim,X-11,Y+1,X-7,Y-2);
    poly(c,p.cloth,[X+2,Y+2,X+9,Y-2,X+11,Y+2,X+6,Y+6,x-1,y-4,x-4,y-4]);rect(c,p.trim,x,y-10,4,2);
  }
  c.save();c.translate(Math.round(neck[0]),Math.round(neck[1]));panels(c,p,heads[id]);c.restore();
  arm(c,id,p,[X-4,Y+2],s.frontE,s.frontH,false);
}

export function drawBuiltinFighter(c,f) {
  const id=baseSkin(f.id), s=skeleton(f), p=colors[id];
  c.save();
  if(f.pose==='ko'){c.translate(0,-3);c.rotate(-Math.PI/2*Math.min(1,(f.poseTick+1)/14));}
  const evade=f.pose==='defense'&&id==='jin'?frameData(currentMove(f)):null;
  if(evade&&f.poseTick<evade.startup+evade.active){
    c.save();c.globalAlpha=.23;c.translate(12,0);body(c,id,p,s);c.restore();
  }
  body(c,id,p,s);c.restore();
}
