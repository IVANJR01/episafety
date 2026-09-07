import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const DIR='/tmp/claude-0/-home-user-episafety/efe23506-ee6a-529b-92e1-07d4ba3f195c/scratchpad/r3d';
const FF='/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const OUT=DIR+'/nr35-modulo01.webm';
fs.mkdirSync(DIR+'/raw',{recursive:true});

const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1280,height:720}});
p.on('pageerror',e=>console.log('ERR:',e.message));
await p.goto('file://'+DIR+'/modulo01.html');
await p.waitForFunction('window.READY===true',{timeout:90000});
const FPS=await p.evaluate(()=>window.FPS), DUR=await p.evaluate(()=>window.DUR);
const SC=await p.evaluate(()=>SC.map(s=>({n:s.n,t0:s.t0,dur:s.dur})));
console.log('duração',DUR+'s  frames',Math.round(DUR*FPS));
const t0=Date.now();
for(const s of SC){
  const f=DIR+'/raw/c'+String(s.n).padStart(2,'0')+'.mjpg';
  if(fs.existsSync(f)&&fs.statSync(f).size>0){console.log('cena',s.n,'já feita');continue;}
  const ws=fs.createWriteStream(f+'.part');
  const N=Math.round(s.dur*FPS);
  for(let k=0;k<N;k++){
    const d=await p.evaluate(t=>{window.seek(t);return window.grab();}, s.t0+k/FPS);
    const buf=Buffer.from(d.slice(d.indexOf(',')+1),'base64');
    if(!ws.write(buf)) await new Promise(r=>ws.once('drain',r));
  }
  await new Promise(r=>ws.end(r));
  fs.renameSync(f+'.part',f);
  console.log('cena',s.n,'ok',N,'frames  ',((Date.now()-t0)/1000|0)+'s');
}
await b.close();
const all=DIR+'/raw/all.mjpg';
fs.writeFileSync(all,Buffer.alloc(0));
for(const s of SC) fs.appendFileSync(all,fs.readFileSync(DIR+'/raw/c'+String(s.n).padStart(2,'0')+'.mjpg'));
console.log('raw',(fs.statSync(all).size/1048576|0)+'MB — codificando');
const ff=spawn(FF,['-y','-f','image2pipe','-c:v','mjpeg','-r',String(FPS),'-i',all,
 '-c:v','libvpx','-b:v','2400k','-deadline','good','-cpu-used','3','-an',OUT],{stdio:['ignore','ignore','pipe']});
let e='';ff.stderr.on('data',d=>{e=(e+d).slice(-300);});
const code=await new Promise(r=>ff.on('close',r));
console.log('ffmpeg exit',code,e);
if(!code){fs.rmSync(DIR+'/raw',{recursive:true,force:true});
  console.log('PRONTO',(fs.statSync(OUT).size/1048576).toFixed(1)+'MB');}
