import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn } from 'node:child_process';
const DIR='/tmp/claude-0/-home-user-episafety/efe23506-ee6a-529b-92e1-07d4ba3f195c/scratchpad/r3d';
const FFMPEG='/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
const OUT=DIR+'/nr35-modulo01-piloto.webm';

const b = await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const p = await b.newPage({ viewport:{width:1280,height:720} });
p.on('pageerror', e=>console.log('ERR:',e.message));
await p.goto('file://'+DIR+'/cena3d.html');
await p.waitForFunction('window.READY===true',{timeout:90000});
const FPS = await p.evaluate(()=>window.FPS), DUR = await p.evaluate(()=>window.DUR);
const N = Math.round(FPS*DUR);
console.log('frames:', N, 'fps:', FPS);

const ff = spawn(FFMPEG, ['-y','-f','image2pipe','-c:v','mjpeg','-r',String(FPS),'-i','-',
  '-c:v','libvpx','-b:v','2800k','-deadline','good','-cpu-used','2','-an', OUT], {stdio:['pipe','ignore','pipe']});
let ffErr=''; ff.stderr.on('data',d=>{ffErr+=d.toString().slice(-400);});
const done = new Promise(r=>ff.on('close',c=>r(c)));

const t0=Date.now();
for(let f=0; f<N; f++){
  const d = await p.evaluate(t=>{ window.seek(t); return window.grab(); }, f/FPS);
  const buf = Buffer.from(d.slice(d.indexOf(',')+1),'base64');
  if(!ff.stdin.write(buf)) await new Promise(r=>ff.stdin.once('drain',r));
  if(f%240===0) console.log('  frame',f,'/',N,((Date.now()-t0)/1000|0)+'s');
}
ff.stdin.end();
const code = await done;
await b.close();
console.log('ffmpeg exit', code);
if(code) console.log(ffErr);
