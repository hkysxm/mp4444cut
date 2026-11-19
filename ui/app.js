const $=id=>document.getElementById(id),api=window.cutApp,v=$('video');
let meta=null,busy=false,proxy=false,native=false,nativePaused=true,seekTarget=null;
function playerCommand(message){return call(api.playerCommand(message));}
function pausePlayback(){if(native)playerCommand({op:'pause',value:true}).catch(e=>status(e.message,true));else v.pause();}
async function seekPlayback(time){if(native){seekTarget={time,until:Date.now()+5000};await playerCommand({op:'seek',time});}else if(v.readyState>0)v.currentTime=time;}
function playerBounds(){if(!native)return;const r=document.querySelector('.screen').getBoundingClientRect(),d=devicePixelRatio;
 playerCommand({op:'bounds',x:Math.round(r.x*d),y:Math.round(r.y*d),width:Math.round(r.width*d),height:Math.round(r.height*d),visible:!$('confirm').open&&r.bottom>0&&r.top>=0}).catch(e=>status(e.message,true));}
api.onPlayer(event=>{
 if(event.type==='state'&&native){nativePaused=event.paused;$('play').textContent=event.paused?'▶':'Ⅱ';if(seekTarget&&Math.abs(event.time-seekTarget.time)<0.08)seekTarget=null;if(!keyPending&&(!seekTarget||Date.now()>seekTarget.until)){$('seek').value=event.time;$('clock').textContent=fmt(event.time);}}
 if(event.type==='error'||event.type==='exit'){const failed=native;native=false;if(!failed)return;playerCommand({op:'stop'}).catch(()=>{});status('内嵌播放器不可用，可生成兼容预览。'+(event.message||''),true);}
});
new ResizeObserver(playerBounds).observe(document.querySelector('.screen'));
window.addEventListener('resize',playerBounds);window.addEventListener('scroll',playerBounds);

function fmt(t){t=Math.max(0,t||0);const ms=Math.round(t*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;}
function parse(s){if(/^\d+(\.\d+)?$/.test(s.trim()))return Number(s);const m=s.trim().match(/^(\d+):([0-5]\d):([0-5]\d(?:\.\d{1,3})?)$/);if(!m)throw new Error('请输入 时:分:秒.毫秒（如 00:01:23.500），或秒数。');return +m[1]*3600 + +m[2]*60 + +m[3];}
function status(text,error=false){$('status').textContent=text;$('status').parentElement.classList.toggle('error',error);}
function lock(value){busy=value;for(const id of ['open','openEmpty','start','end','setStart','setEnd','export','proxy','external','prevKey','nextKey'])$(id).disabled=value||(!meta&&!['open','openEmpty'].includes(id));$('proxy').disabled=value||!meta||proxy;$('cancel').hidden=!value;$('progress').hidden=!value;if(value){$('progress').removeAttribute('value');$('reveal').hidden=true;}}
async function call(task){const result=await task;if(!result.ok)throw new Error(result.error);return result.value;}
async function operation(fn){if(busy||keyPending)return;stopHold();lock(true);try{await fn();}catch(e){status(e.message,true);}finally{lock(false);}}
function selected(){try{const a=parse($('start').value),b=parse($('end').value);$('selection').textContent=b>a?`选取 ${fmt(b-a)}`:'请调整裁切范围';}catch{$('selection').textContent='时间格式无效';}}
async function open(){stopHold();if(keyPending)return;await operation(async()=>{status('正在读取视频信息…');const data=await call(api.open());if(!data){status('已取消打开');return;}meta=data;proxy=false;native=false;$('previewTag').hidden=true;try{native=await call(api.playerStart());}catch(e){status(e.message,true);}if(native){v.removeAttribute('src');v.load();nativePaused=true;seekTarget={time:0,until:Date.now()+5000};requestAnimationFrame(playerBounds);}else v.src=data.url;v.classList.add('active');$('empty').hidden=true;$('filename').textContent=data.name;$('metadata').textContent=`${data.width} × ${data.height} · ${data.codec.toUpperCase()} · ${(data.bitrate/1e6).toFixed(1)} Mbps · ${(data.size/1e9).toFixed(2)} GB`;$('duration').textContent=fmt(data.duration);$('start').value=fmt(0);$('end').value=fmt(data.duration);$('seek').max=data.duration;$('seek').value=0;$('seek').disabled=false;$('play').disabled=false;selected();status('视频已打开。设置起点与终点后即可裁切。');});}
$('open').onclick=open;$('openEmpty').onclick=open;
async function play(){if(!meta)return;try{if(native)await playerCommand({op:'pause',value:!nativePaused});else if(v.paused)await v.play();else v.pause();}catch{status('当前编码无法直接预览。可点击“本地播放器”直接播放原片，或生成兼容预览在本页定位；仍可直接无损裁切。',true);}}
$('play').onclick=play;v.onplay=()=>{$('play').textContent='Ⅱ';};v.onpause=()=>{$('play').textContent='▶';};v.ontimeupdate=()=>{$('clock').textContent=fmt(v.currentTime);$('seek').value=v.currentTime;};
v.onerror=()=>status(proxy?'兼容预览无法播放，请重新生成。':'此视频编码无法直接播放。可用“本地播放器”直接播放，或生成兼容预览；裁切原片不需要转码。',true);
$('seek').oninput=()=>{const t=Number($('seek').value);$('clock').textContent=fmt(t);seekPlayback(t).catch(e=>status(e.message,true));};
function mark(id){if(!meta||busy)return;$(id).value=fmt(Number($('seek').value));selected();}
$('setStart').onclick=()=>mark('start');$('setEnd').onclick=()=>mark('end');$('start').oninput=selected;$('end').oninput=selected;
$('proxy').onclick=()=>operation(async()=>{pausePlayback();status('正在生成兼容预览。高码率或长视频可能需要较长时间，可随时取消。');const position=Number($('seek').value);const url=await call(api.proxy());if(native){await playerCommand({op:'stop'});native=false;}proxy=true;v.src=url+'?v='+Date.now();v.addEventListener('loadedmetadata',()=>{v.currentTime=Math.min(position,v.duration);},{once:true});$('previewTag').hidden=false;status('兼容预览已就绪。预览可能不准确呈现 HDR / Log 色彩；导出使用原始视频。');});
$('export').onclick=()=>operation(async()=>{pausePlayback();status('正在查找关键帧…');const start=parse($('start').value),end=parse($('end').value);const p=await call(api.plan(start,end));$('planned').textContent=`起点  ${fmt(p.start)}\n终点  ${fmt(p.end)}\n时长  ${fmt(p.end-p.start)}\n比所选范围多保留 ${((start-p.start)+(p.end-end)).toFixed(3)} 秒`;$('confirm').showModal();playerBounds();status('请确认实际裁切范围。');});
$('back').onclick=()=>{$('confirm').close();playerBounds();};$('save').onclick=()=>{$('confirm').close();playerBounds();operation(async()=>{status('正在保存无损片段…');const name=await call(api.export());if(name){status(`已保存：${name}`);$('reveal').hidden=false;}else status('已取消保存');});};
$('cancel').onclick=()=>{api.cancel();status('正在取消…');};$('reveal').onclick=()=>call(api.reveal()).catch(e=>status(e.message,true));
api.onProgress(p=>{$('progress').value=p.percent;status(`${p.stage} · ${Math.floor(p.percent)}%`);});
document.addEventListener('keydown',e=>{if(/INPUT|BUTTON/.test(e.target.tagName)||$('confirm').open||busy)return;if(e.code==='Space'){e.preventDefault();play();}if(e.code==='KeyI')mark('start');if(e.code==='KeyO')mark('end');});

$('external').onclick=()=>operation(async()=>{
 pausePlayback();await call(api.external());
 status('已调用系统默认播放器播放原片，无需转码。可将 MPC-HC / MPC-BE 等设为默认播放器；外部播放进度不会同步，请在本页设置裁切时间。');
});
$('fullscreen').onclick=async()=>{try{
 if(document.fullscreenElement)await document.exitFullscreen();
 else await document.documentElement.requestFullscreen();
}catch(e){status('无法进入全屏：'+e.message,true);}};
document.addEventListener('fullscreenchange',()=>{
 const full=!!document.fullscreenElement;
 document.body.classList.toggle('fullscreen',full);
 $('fullscreen').textContent=full?'退出全屏':'全屏';
 $('fullscreen').setAttribute('aria-pressed',String(full));
});
let keyPending=false,holdTimer,held=null;
function stopHold(){held=null;clearTimeout(holdTimer);}
async function jumpKey(direction){
 if(!meta||busy||keyPending)return false;
 keyPending=true;pausePlayback();
 try{
  const next=await call(api.keyframe(Number($('seek').value),direction));
  if(next===null){status(direction<0?'已到首个关键帧':'已到最后一个关键帧');return false;}
  $('seek').value=next;$('clock').textContent=fmt(next);
  await seekPlayback(next);
  status('已定位关键帧 '+fmt(next));return true;
 }catch(e){status(e.message,true);return false;}finally{keyPending=false;}
}
for(const [id,direction] of [['prevKey',-1],['nextKey',1]]){
 const button=$(id);
 button.onpointerdown=async e=>{
  if(e.button!==0||busy||!meta)return;
  e.preventDefault();stopHold();const token={};held=token;
  button.setPointerCapture(e.pointerId);
  const repeat=async()=>{if(held!==token)return;const moved=await jumpKey(direction);if(held===token&&moved)holdTimer=setTimeout(repeat,160);};
  const moved=await jumpKey(direction);
  if(held===token&&moved)holdTimer=setTimeout(repeat,400);
 };
 button.onpointerup=stopHold;button.onpointercancel=stopHold;button.onlostpointercapture=stopHold;
 button.onclick=e=>{if(e.detail===0)jumpKey(direction);};
}
window.addEventListener('blur',stopHold);
document.addEventListener('visibilitychange',stopHold);

$('confirm').addEventListener('close',playerBounds);
