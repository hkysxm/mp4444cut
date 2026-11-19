const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');const path=require('node:path');
const {Engine}=require('../engine');
const engine=new Engine();let dir;
async function setup(){if(!dir)dir=await fs.mkdtemp(path.join(os.tmpdir(),'qingcut-test-'));}
after(async()=>{engine.stop();if(dir)await fs.rm(dir,{recursive:true,force:true});});
async function sample(name,codec,pix,tag){await setup();const file=path.join(dir,name+'.mp4');await engine.run('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-f','lavfi','-i','sine=frequency=880:sample_rate=48000','-t','8','-map','0:v','-map','1:a','-map','2:a','-c:v',codec,'-pix_fmt',pix,'-g','60',...(codec==='libx265'?['-x265-params','pools=2:log-level=error:open-gop=0']:['-sc_threshold','0']),'-c:a','aac',...(tag?['-tag:v',tag]:[]),file]);return file;}
async function hashes(file){return JSON.parse(await engine.run('ffprobe',['-v','error','-show_packets','-show_data_hash','sha256','-show_entries','packet=stream_index,data_hash','-of','json',file])).packets;}
for(const [name,codec,pix,tag] of [['h264','libx264','yuv420p'],['hevc8-hev1','libx265','yuv420p','hev1'],['hevc10-hvc1','libx265','yuv420p10le','hvc1'],['hevc422-10','libx265','yuv422p10le','hvc1']])test(`${name}: keyframe cut preserves every compressed packet and all audio tracks`,async()=>{
 const file=await sample(name,codec,pix,tag),meta=await engine.probe(file);const plan=await engine.plan(file,2.7,5.1,meta);assert.ok(Math.abs(plan.start-2)<0.01);assert.ok(Math.abs(plan.end-6)<0.01);
 assert.equal(await engine.adjacentKey(file,2,1,meta),4);
 assert.equal(await engine.adjacentKey(file,2,-1,meta),0);
 assert.equal(await engine.adjacentKey(file,2.7,-1,meta),2);
 assert.equal(await engine.adjacentKey(file,0,-1,meta),null);
 assert.equal(await engine.adjacentKey(file,6,1,meta),null);
 await assert.rejects(engine.adjacentKey(file,NaN,1,meta),/无效/);
 const output=path.join(dir,name+'-cut.mp4');await engine.cut(file,output,plan);const cut=await engine.probe(output);assert.equal(cut.codec,meta.codec);assert.equal(cut.pixelFormat,meta.pixelFormat);assert.equal(cut.streams.filter(s=>s.codec_type==='audio').length,2);
 const originals=new Set((await hashes(file)).map(p=>p.stream_index+':'+p.data_hash)),packets=await hashes(output);assert.ok(packets.length>100);for(const p of packets)assert.ok(originals.has(p.stream_index+':'+p.data_hash),'compressed packet changed');
 await engine.run('ffmpeg',['-v','error','-xerror','-i',output,'-f','null','-']);
 const before=await fs.readFile(output);await assert.rejects(engine.cut(file,output,plan),/EEXIST/);assert.deepEqual(await fs.readFile(output),before);
 await assert.rejects(engine.plan(file,5,2,meta),/有效/);
 if(codec==='libx265'){const preview=path.join(dir,'preview.mp4');await engine.proxy(file,preview);const m=await engine.probe(preview);assert.equal(m.codec,'h264');assert.equal(m.pixelFormat,'yuv420p');assert.ok(Math.abs(m.duration-meta.duration)<0.2);await engine.run('ffmpeg',['-v','error','-xerror','-i',preview,'-f','null','-']);}
});
test('cancellation cleans partial files and never changes source',async()=>{const file=await sample('cancel','libx264','yuv420p');const controller=new AbortController();controller.abort();const out=path.join(dir,'cancel-out.mp4');await assert.rejects(engine.cut(file,out,{start:0,end:5},{signal:controller.signal}));await assert.rejects(fs.stat(out));assert.ok(!(await fs.readdir(dir)).some(n=>n.startsWith('.qingcut')));});
