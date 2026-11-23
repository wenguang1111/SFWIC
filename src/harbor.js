import { surface, rect, poly, line } from './pixels.js';

// A 2:1 pixel grid for the 960 × 400 arena. Paint the masonry, latticework and
// perspective floor just once; only signal lamps, water and embers move.
export const FLOOR = 173;
let backdrop;
function makeHarbor() {
  const canvas = surface(480, 200), c = canvas.getContext('2d');
  let seed = 44217;
  const rand = n => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296 * n) | 0;
  const r = (k,x,y,w,h) => rect(c,k,x,y,w,h), l = (k,...args) => line(c,k,...args), p = (k,...args) => poly(c,k,args);
  const gradient = c.createLinearGradient(0,0,0,125);
  gradient.addColorStop(0,'#191e38'); gradient.addColorStop(.5,'#403653'); gradient.addColorStop(.84,'#86515d'); gradient.addColorStop(1,'#cf7a6e');
  c.fillStyle = gradient; c.fillRect(0,0,480,127);
  for (let i = 0; i < 100; i++) r(i%6 ? '#7c6e87':'#b5acaf', rand(480), rand(79), 1,1);
  // Small patinated amber moon, partly occluded by the higher haze.
  for (let y = -17; y <= 17; y++) {
    const half = Math.floor(Math.sqrt(17*17-y*y));
    r(y < -7 ? '#ecb2a0': y < 4 ? '#e8a89a':'#d59691',326-half,34+y,half*2+1,1);
  }
  for (let i = 0; i < 11; i++) r('#db9e94',315+rand(19),27+rand(17),1+rand(4),1);
  for (let i = 0; i < 35; i++) { const x = rand(480)-10, y = 18+rand(75), w=7+rand(62); r(y<40?'#514157':'#805563',x,y,w,1); r(y<40?'#4a3d54':'#735064',x+4,y+1,w*.6,1); }
  for (let i = 0; i < 95; i++) {
    const x=rand(480), w=3+rand(9), h=4+rand(28), y=115-h;
    r('#785566',x,y,w,h); if(i%3===0) r('#785566',x+w/2,y-4,1,4);
  }
  for (let x=-3; x<480;) {
    const w=6+rand(16), h=13+rand(40), y=119-h, hcol=rand(2)?'#51465a':'#5c485c';
    r(hcol,x,y,w,h);r('#6e5060',x+w-2,y,2,h);
    if(w>13) {r(hcol,x+3,y-3,w-6,3);r(hcol,x+5,y-5,w-10,3);}
    for(let wy=y+4;wy<118;wy+=4) for(let wx=x+2;wx<x+w-2;wx+=3) if(rand(5)<2)r(rand(3)?'#ab7879':'#a095a2',wx,wy,1+rand(2),1);
    x+=w+rand(5);
  }
  // Long-distance bridge and cable stays.
  const bridge='#434051';
  for(const x of [99,192]) {r(bridge,x,70,2,42);r('#875b6e',x+2,70,1,38); for(let i=1;i<=4;i++){ l('#5d4b60',x,75+i*2,x-i*7,101);l('#5d4b60',x+1,75+i*2,x+i*7,101); }}
  r(bridge,54,101,185,3);r('#9c6876',58,100,179,1);
  // A few closer warehouse towers, with emissive strips and rooftop tanks.
  for (const [x,y,w,h] of [[7,67,21,56],[41,84,27,39],[228,78,18,45],[267,92,29,31],[353,78,24,45],[429,69,18,54]]) {
    r('#37394a',x,y,w,h);r('#514454',x+w-3,y,3,h);r('#37394a',x+4,y-3,w-9,4);r('#514454',x+5,y-7,2,5);
    for(let row=y+5;row<118;row+=5)for(let col=x+3;col<x+w-3;col+=4)if(rand(4))r(rand(3)?'#776074':'#b77b76',col,row,2,1);
  }
  r('#3e3b50',0,119,480,17);r('#9e6670',0,121,480,1);
  for(let i=0;i<295;i++)r(['#765365','#574857','#88616c','#5b6573'][rand(4)],rand(480),122+rand(13),2+rand(13),1);
  // Four-port crane girders; the closest silhouette frames rather than hides the fighters.
  function crane(x,y,size,flip) {
    c.save();c.translate(x,y);c.scale(flip*size,size);
    p('#292e3e',-7,93,-4,31,2,30,5,93,1,93,-1,48,-3,93);
    p('#3a3446',-6,34,-8,26,4,22,8,30,4,36);r('#696075',-7,27,8,1);r('#b48a7e',0,26,3,2);
    l('#333345',-14,30,40,2,2);l('#473b4c',-14,24,40,0,2);l('#755668',-14,24,40,0);
    for(let i=0;i<7;i++){const t=i/7,q=(i+1)/7; l('#4e4052',-14+54*t,30-28*t,-14+54*q,24-24*q);}
    l('#45394a',-4,28,0,4,2);l('#6c4b5b',0,4,37,2);l('#4e4052',0,4,-14,25);
    l('#493e51',36,3,36,38);l('#493e51',39,3,39,38);r('#514353',35,38,6,2);r('#493e51',37,39,2,4);
    r('#e18a7d',39,0,1,1);c.restore();
  }
  crane(147,62,.67,-1);crane(266,61,.74,1);crane(389,45,.96,-1);crane(54,33,1.16,1);
  // Dock edge and cargo containers with corrugated sides.
  r('#242b38',0,133,480,9);r('#49505b',0,133,480,2);
  for(const [x,y,w,h,base,lit] of [[0,125,41,11,'#47424b','#83616a'],[4,115,30,10,'#59464a','#896167'],[415,120,40,15,'#36464d','#58747a'],[450,116,43,19,'#574146','#896064']]) {
    r('#272d38',x-1,y-1,w+2,h+2);r(base,x,y,w,h);r(lit,x,y,w,1);
    for(let i=3;i<w-2;i+=4){r(lit,x+i,y+2,1,h-4);r('#363641',x+i+1,y+2,1,h-4);}r('#b4a095',x+3,y+3,4,2);
  }
  // Railings, floodlights, ducts and stencilled hazard markers.
  r('#222834',0,140,480,6);r('#53515a',0,139,480,1);
  for(let x=0;x<480;x+=24){r('#232935',x,128,2,12);r('#69606b',x,128,1,9);}r('#3a3c48',0,128,480,2);r('#8b7279',0,128,480,1);r('#3b3d48',0,134,480,1);
  for (const x of [18,207,454]) {r('#333544',x,99,2,31);r('#5a5361',x,99,8,1);r('#d8a68f',x+4,100,6,1);r('#9a7477',x+5,101,4,1);}
  r('#4d4954',0,146,480,54);r('#74616b',0,146,480,2);r('#383a46',0,150,480,1);
  for(let i=0;i<260;i++)r(i%4?'#514c58':'#5a505a',rand(480),149+rand(51),1+rand(7),1);
  for(const y of [156,168,189]) {r('#363844',0,y,480,1);r('#635761',0,y+1,480,1);}
  for(let x=-350;x<800;x+=72){let lo=240+(x-240)*1.75;l('#343743',x,147,lo,199);l('#645963',x+1,147,lo+2,199);}
  for(let x=0;x<480;x+=23){p('#9a7868',x,146,x+8,146,x+5,148,x-3,148);}
  for(const x of [16,385]){p('#333944',x,159,x+42,159,x+50,164,x+4,164);for(let n=0;n<10;n++) l('#68616a',x+2+n*4,160,x+5+n*4,163);}
  for(let i=0;i<90;i++) { const x=rand(480),y=165+rand(34);r(i%4?'#62545e':'#786364',x,y,2+rand(8),1); }
  return canvas;
}

export function drawHarbor(c,tick) {
  backdrop ||= makeHarbor(); c.drawImage(backdrop,0,0);
  for(let n=0;n<13;n++){const x=(n*73+Math.floor(tick/(6+n%3)))%480;rect(c,n%3?'#97707a':'#729096',x,122+n%10,2+n%6,1);}
  if((tick%110)<22){rect(c,'#ffa089',100,32,2,1);rect(c,'#f09181',350,44,1,1);}
}
