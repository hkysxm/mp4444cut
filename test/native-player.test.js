const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
const os=require('node:os');
const {Engine}=require('../engine');
const {NativePlayer}=require('../native-player');
test('Windows embedded libmpv decodes HEVC and synchronizes exact seek and pause',{skip:process.platform!=='win32',timeout:45000},async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'qingcut-mpv-test-'));
 let player;const events=[];
 const wait=async predicate=>{const deadline=Date.now()+15000;while(Date.now()<deadline){const error=events.find(e=>e.type==='error');if(error)throw new Error(error.message);const found=events.find(predicate);if(found)return found;await new Promise(r=>setTimeout(r,50));}throw new Error('Timed out waiting for native playback state');};
 try{
  const file=path.join(dir,'hevc.mp4');
  await new Engine().run('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=320x180:rate=30','-t','6','-c:v','libx265','-x265-params','pools=2:log-level=error','-g','60',file]);
  player=new NativePlayer(path.join(__dirname,'../vendor/mpv/QingCut.Player.exe'),Buffer.alloc(8),e=>events.push(e));
  await player.ready;
  player.send({op:'bounds',x:0,y:0,width:640,height:360,visible:true});
  player.send({op:'load',file});
  await wait(e=>e.type==='state'&&e.time<0.1&&e.paused);
  events.length=0;player.send({op:'seek',time:2});
  const state=await wait(e=>e.type==='state'&&Math.abs(e.time-2)<0.08);assert.equal(state.paused,true);
  events.length=0;player.send({op:'pause',value:false});await wait(e=>e.type==='state'&&e.time>2.3&&!e.paused);
  events.length=0;player.send({op:'pause',value:true});await wait(e=>e.type==='state'&&e.paused);
 }finally{player?.stop();await new Promise(r=>setTimeout(r,1800));await fs.rm(dir,{recursive:true,force:true});}
});
