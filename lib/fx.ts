/* Lifted straight from the original single-page build: sounds, the shot
   animation, the pitch map and the shareable card. Plain DOM, no React. */
/* eslint-disable */
// @ts-nocheck
let SFXON = true;
export const setSfx = (on: boolean) => { SFXON = on; };
export const getSfx = () => SFXON;
const RM = typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function buzz(ms){ try{ navigator.vibrate && navigator.vibrate(ms); }catch(e){} }

/* ---------- sound: everything synthesised, no files ---------- */
let AC=null, SFXON=true;
export function sfxInit(){
  if(AC!==null) { if(AC && AC.state==='suspended') AC.resume().catch(()=>{}); return AC; }
  try{ const C=window.AudioContext||window.webkitAudioContext; AC = C ? new C() : false; }
  catch(e){ AC=false; }
  if(AC && AC.state==='suspended') AC.resume().catch(()=>{});
  return AC||null;
}
function noiseBuf(ctx,secs){
  const n=Math.max(1,Math.floor(ctx.sampleRate*secs)), b=ctx.createBuffer(1,n,ctx.sampleRate), d=b.getChannelData(0);
  for(let i=0;i<n;i++) d[i]=Math.random()*2-1;
  return b;
}
function env(ctx,node,vol,dur,attack){
  const g=ctx.createGain(), t=ctx.currentTime, a=attack||0.005;
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(vol,t+a);
  g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  node.connect(g); g.connect(ctx.destination);
  return g;
}
export function sfx(name){
  if(!SFXON) return;
  const ctx=sfxInit(); if(!ctx) return;
  const t=ctx.currentTime;
  try{
    if(name==='kick'){
      const o=ctx.createOscillator(); o.type='sine';
      o.frequency.setValueAtTime(190,t); o.frequency.exponentialRampToValueAtTime(52,t+0.11);
      env(ctx,o,0.5,0.15); o.start(t); o.stop(t+0.16);
      const s=ctx.createBufferSource(); s.buffer=noiseBuf(ctx,0.06);
      const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1600;
      s.connect(f); env(ctx,f,0.32,0.07); s.start(t); s.stop(t+0.07);
    }
    else if(name==='net'){
      const s=ctx.createBufferSource(); s.buffer=noiseBuf(ctx,0.26);
      const f=ctx.createBiquadFilter(); f.type='bandpass'; f.frequency.setValueAtTime(2400,t);
      f.frequency.exponentialRampToValueAtTime(700,t+0.25); f.Q.value=1.1;
      s.connect(f); env(ctx,f,0.3,0.26,0.012); s.start(t); s.stop(t+0.27);
    }
    else if(name==='block'){
      const o=ctx.createOscillator(); o.type='square';
      o.frequency.setValueAtTime(150,t); o.frequency.exponentialRampToValueAtTime(70,t+0.13);
      const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=900;
      o.connect(f); env(ctx,f,0.22,0.15); o.start(t); o.stop(t+0.16);
    }
    else if(name==='over'){
      const o=ctx.createOscillator(); o.type='sine';
      o.frequency.setValueAtTime(520,t); o.frequency.exponentialRampToValueAtTime(130,t+0.42);
      env(ctx,o,0.22,0.45,0.02); o.start(t); o.stop(t+0.46);
    }
    else if(name==='whistle'||name==='fulltime'){
      const long = name==='fulltime';
      const blast=(at,len)=>{
        [2180,2760].forEach((hz,i)=>{
          const o=ctx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(hz,at);
          const lfo=ctx.createOscillator(), lg=ctx.createGain();
          lfo.frequency.value=38; lg.gain.value=hz*0.018;
          lfo.connect(lg); lg.connect(o.frequency);
          const g=ctx.createGain();
          g.gain.setValueAtTime(0.0001,at);
          g.gain.exponentialRampToValueAtTime(i?0.1:0.17,at+0.02);
          g.gain.setValueAtTime(i?0.1:0.17,at+len-0.05);
          g.gain.exponentialRampToValueAtTime(0.0001,at+len);
          o.connect(g); g.connect(ctx.destination);
          o.start(at); o.stop(at+len+0.02); lfo.start(at); lfo.stop(at+len+0.02);
        });
      };
      if(long){ blast(t,0.16); blast(t+0.24,0.16); blast(t+0.48,0.52); }
      else blast(t,0.3);
    }
    else if(name==='cheer'){
      const s=ctx.createBufferSource(); s.buffer=noiseBuf(ctx,1.1);
      const f=ctx.createBiquadFilter(); f.type='bandpass'; f.Q.value=0.8;
      f.frequency.setValueAtTime(420,t); f.frequency.linearRampToValueAtTime(1500,t+0.35);
      f.frequency.linearRampToValueAtTime(600,t+1.05);
      const g=ctx.createGain();
      g.gain.setValueAtTime(0.0001,t);
      g.gain.linearRampToValueAtTime(0.3,t+0.3);
      g.gain.linearRampToValueAtTime(0.0001,t+1.1);
      s.connect(f); f.connect(g); g.connect(ctx.destination);
      s.start(t); s.stop(t+1.12);
      [523,659,784,1047].forEach((hz,i)=>{
        const o=ctx.createOscillator(); o.type='triangle'; o.frequency.value=hz;
        const at=t+i*0.09, gg=ctx.createGain();
        gg.gain.setValueAtTime(0.0001,at);
        gg.gain.exponentialRampToValueAtTime(0.16,at+0.02);
        gg.gain.exponentialRampToValueAtTime(0.0001,at+0.3);
        o.connect(gg); gg.connect(ctx.destination); o.start(at); o.stop(at+0.32);
      });
    }
    else if(name==='tick'){
      const o=ctx.createOscillator(); o.type='square'; o.frequency.value=1200;
      env(ctx,o,0.07,0.045); o.start(t); o.stop(t+0.05);
    }
  }catch(e){}
}

function drawStage(y,miss){
  const W=340,H=128, gx=W-26, gy=H/2;
  const sx = miss ? 46 : (gx-16) - (Math.min(y,100)/100)*(gx-16-34);
  const sy = gy + (y%2?-16:16);
  const p=[];
  p.push('<rect width="'+W+'" height="'+H+'" fill="#14301F"/>');
  for(let i=0;i<8;i++) if(i%2===0) p.push('<rect x="'+(i*W/8)+'" y="0" width="'+(W/8)+'" height="'+H+'" fill="#173823"/>');
  const L='stroke="rgba(255,255,255,.26)" fill="none" stroke-width="1.1"';
  p.push('<rect x="'+(W-60)+'" y="'+(gy-44)+'" width="52" height="88" '+L+'/>');
  p.push('<rect x="'+(W-28)+'" y="'+(gy-22)+'" width="20" height="44" '+L+'/>');
  p.push('<rect id="netg" x="'+(gx-2)+'" y="'+(gy-15)+'" width="7" height="30" rx="1" fill="#F1F5EF"/>');
  p.push('<path id="arc" d="" stroke="'+(miss?'#D2443A':'#FF7A2F')+'" stroke-width="1.6" fill="none" stroke-dasharray="3 3" opacity=".8"/>');
  p.push('<circle id="boot" cx="'+sx+'" cy="'+sy+'" r="11" fill="rgba(255,122,47,.18)" stroke="#FF7A2F" stroke-width="1.3"/>');
  p.push('<circle id="ball" cx="'+sx+'" cy="'+sy+'" r="5.5" fill="#F1F5EF"/>');
  if(!miss) p.push('<text x="'+sx+'" y="'+(sy-18)+'" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10" font-weight="600" fill="#FF7A2F">'+y+' yds</text>');
  document.getElementById('r-stage').innerHTML=p.join('');
  return {sx,sy,gx,gy,W,H};
}

export function flyShot(y,miss){
  const g=drawStage(y,miss);
  const ball=document.getElementById('r-stage').querySelector('#ball'), arc=document.getElementById('r-stage').querySelector('#arc'),
        net=document.getElementById('r-stage').querySelector('#netg');
  const ex = miss ? g.W+16 : g.gx+1;
  const ey = miss ? g.gy-54 : g.gy + (Math.random()*18-9);
  const cx=(g.sx+ex)/2, cy=Math.min(g.sy,ey)-34;
  const bez=t=>({x:(1-t)*(1-t)*g.sx+2*(1-t)*t*cx+t*t*ex, y:(1-t)*(1-t)*g.sy+2*(1-t)*t*cy+t*t*ey});
  if(miss) sfx('over');
  if(RM){ const e=bez(1); ball.setAttribute('cx',e.x); ball.setAttribute('cy',e.y);
    arc.setAttribute('d','M '+g.sx+' '+g.sy+' Q '+cx+' '+cy+' '+ex+' '+ey); if(!miss) sfx('net'); return; }
  const dur=720, t0=performance.now();
  (function step(now){
    const t=Math.min(1,(now-t0)/dur);
    const e=t*t*(3-2*t), pt=bez(e);
    ball.setAttribute('cx',pt.x); ball.setAttribute('cy',pt.y);
    arc.setAttribute('d','M '+g.sx+' '+g.sy+' Q '+(g.sx+(cx-g.sx)*e)+' '+(g.sy+(cy-g.sy)*e)+' '+pt.x+' '+pt.y);
    if(t<1) requestAnimationFrame(step);
    else if(!miss){
      net.setAttribute('width','11'); net.setAttribute('x',g.gx-4); buzz(45); sfx('net');
      setTimeout(()=>{ net.setAttribute('width','7'); net.setAttribute('x',g.gx-2); },170);
    }
  })(t0);
}

export function drawMap(results){
  const W=340,H=200,pad=10,gx=W-pad-6,p=[];
  p.push('<rect width="'+W+'" height="'+H+'" fill="#14301F"/>');
  for(let i=0;i<8;i++) if(i%2===0) p.push('<rect x="'+(pad+i*((W-2*pad)/8))+'" y="'+pad+'" width="'+((W-2*pad)/8)+'" height="'+(H-2*pad)+'" fill="#173823"/>');
  const L='stroke="rgba(255,255,255,.3)" fill="none" stroke-width="1.1"';
  p.push('<rect x="'+pad+'" y="'+pad+'" width="'+(W-2*pad)+'" height="'+(H-2*pad)+'" '+L+'/>');
  p.push('<line x1="'+(W/2)+'" y1="'+pad+'" x2="'+(W/2)+'" y2="'+(H-pad)+'" '+L+'/>');
  p.push('<circle cx="'+(W/2)+'" cy="'+(H/2)+'" r="26" '+L+'/>');
  p.push('<rect x="'+(W-pad-46)+'" y="'+(H/2-46)+'" width="46" height="92" '+L+'/>');
  p.push('<rect x="'+(W-pad-18)+'" y="'+(H/2-22)+'" width="18" height="44" '+L+'/>');
  p.push('<rect x="'+(gx-1)+'" y="'+(H/2-13)+'" width="6" height="26" fill="#F1F5EF" rx="1"/>');
  const scale=y=>gx-6-(Math.min(y,100)/100)*(gx-6-pad-8);
  const slots=[-52,-34,-16,2,20,38,56];
  results.forEach((r,i)=>{
    const cy=H/2+slots[i], cx=r.yds?scale(r.yds):pad+14, col=r.yds===100?'#FFC73D':'#FF7A2F';
    if(r.yds>0){
      p.push('<path d="M '+cx+' '+cy+' Q '+((cx+gx)/2)+' '+(cy+(cy<H/2?14:-14))+' '+(gx-4)+' '+(H/2)+'" stroke="'+col+'" stroke-width="1.4" fill="none" stroke-dasharray="3 3" opacity=".75"/>');
      p.push('<circle cx="'+cx+'" cy="'+cy+'" r="10" fill="'+col+'"/>');
      p.push('<text x="'+cx+'" y="'+(cy+3.6)+'" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="9.5" font-weight="600" fill="#1A0C03">'+r.yds+'</text>');
    } else {
      p.push('<circle cx="'+cx+'" cy="'+cy+'" r="9" fill="none" stroke="#D2443A" stroke-width="1.6"/>');
      p.push('<path d="M '+(cx-4)+' '+(cy-4)+' L '+(cx+4)+' '+(cy+4)+' M '+(cx+4)+' '+(cy-4)+' L '+(cx-4)+' '+(cy+4)+'" stroke="#D2443A" stroke-width="1.6"/>');
    }
  });
  [[100,'100'],[55,'55'],[25,'25']].forEach(([y,lab])=>
    p.push('<text x="'+scale(y)+'" y="'+(H-2)+'" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="8.5" fill="rgba(255,255,255,.45)">'+lab+'</text>'));
  document.getElementById('d-map').innerHTML=p.join('');
  const m=results.filter(r=>!r.yds).length;
  const leg=document.getElementById('d-maplegend');
  if(leg) leg.textContent = m ? m+' tackled, marked in red on the left.' : 'Every shot got away. Not one tackle.';
}

/* ---------- score card, drawn on a canvas so it can be saved or sent as a picture ---------- */
export async function drawCard(results,total,tierName,who,md,got){
  const c=document.getElementById('card'); if(!c||!c.getContext) return;
  const W=1080,H=1350, x=c.getContext('2d');
  c.width=W; c.height=H;
  try{ if(document.fonts&&document.fonts.ready) await document.fonts.ready; }catch(e){}
  const D='"Archivo Black","Arial Black",sans-serif', B='Archivo,Arial,sans-serif', M='"IBM Plex Mono",monospace';
  const GOLD='#FFC73D', HIVIZ='#FF7A2F', CHALK='#F1F5EF', DIM='#8C9D91', BAD='#D2443A';
  const box=(px,py,pw,ph,r)=>{ x.beginPath();
    if(x.roundRect) x.roundRect(px,py,pw,ph,r); else x.rect(px,py,pw,ph); x.fill(); };
  x.fillStyle='#0A140E'; x.fillRect(0,0,W,H);
  const g=x.createRadialGradient(W/2,-120,40,W/2,-120,1000);
  g.addColorStop(0,'rgba(80,130,100,.30)'); g.addColorStop(1,'rgba(80,130,100,0)');
  x.fillStyle=g; x.fillRect(0,0,W,H);
  x.fillStyle='rgba(255,255,255,.018)';
  for(let i=0;i<W;i+=176) x.fillRect(i,0,88,H);
  const P=78;
  x.strokeStyle=HIVIZ; x.lineWidth=5;
  x.beginPath(); x.arc(P+34,P+34,34,0,Math.PI*2); x.stroke();
  x.fillStyle=HIVIZ; x.font='23px '+D; x.textAlign='center'; x.textBaseline='middle';
  x.fillText('H&A',P+34,P+36);
  x.textAlign='left'; x.textBaseline='alphabetic';
  x.fillStyle=CHALK; x.font='40px '+D; x.fillText('HAME & AWAY',P+90,P+30);
  x.fillStyle=DIM; x.font='20px '+M; x.fillText('MATCHDAY #'+md,P+90,P+62);
  x.fillStyle=HIVIZ; x.font='36px '+D; x.fillText(String(who).toUpperCase(),P,P+196);
  x.fillStyle=CHALK; x.font='205px '+D;
  const tw=x.measureText(String(total)).width;
  x.fillText(String(total),P,P+372);
  x.fillStyle=HIVIZ; x.font='52px '+D; x.fillText('/700',P+tw+20,P+372);
  x.fillStyle=DIM; x.font='21px '+M; x.fillText('YARDS',P+tw+24,P+410);
  x.fillStyle=GOLD; x.font='40px '+D; x.fillText(String(tierName).toUpperCase(),P,P+476);
  const by=P+516, bw=W-P*2;
  x.fillStyle='#23382B'; box(P,by,bw,14,7);
  const lg=x.createLinearGradient(P,0,P+bw,0);
  lg.addColorStop(0,'#1D4E33'); lg.addColorStop(.55,'#2F7E50'); lg.addColorStop(1,HIVIZ);
  x.fillStyle=lg; box(P,by,Math.max(14,bw*(total/700)),14,7);
  let y=by+84;
  x.fillStyle=DIM; x.font='20px '+M; x.fillText('HOW FAR OUT EACH SHOT WAS',P,y); y+=42;
  /* No answer names on the card: it gets shared before everyone has played. */
  const lw=58, barw=W-P*2-lw-104;
  results.forEach((r,i)=>{
    x.fillStyle=DIM; x.font='24px '+M; x.fillText(String(i+1),P,y+26);
    x.fillStyle='#17291E'; box(P+lw,y+4,barw,24,12);
    x.fillStyle=r.yds===0?BAD:(r.kg?GOLD:HIVIZ);
    box(P+lw,y+4,Math.max(10,barw*(r.yds/100)),24,12);
    x.fillStyle=r.yds===0?BAD:(r.kg?GOLD:CHALK);
    x.font='26px '+M; x.textAlign='right'; x.fillText(String(r.yds),W-P,y+26); x.textAlign='left';
    y+=56;
  });
  y+=16;
  x.strokeStyle='#23382B'; x.lineWidth=2;
  x.beginPath(); x.moveTo(P,y); x.lineTo(W-P,y); x.stroke();
  x.fillStyle=got?GOLD:DIM; x.font='26px '+M;
  x.fillText(got? got+" KEEPER'S GOAL"+(got>1?'S':'') : 'NO KEEPERS TODAY', P, y+48);
  x.fillStyle=DIM; x.font='24px '+B; x.textAlign='right';
  x.fillText('Hame Bakery Premiership',W-P,y+48); x.textAlign='left';
}

