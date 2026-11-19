const {app,BrowserWindow,dialog,ipcMain,shell}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const {pathToFileURL}=require('node:url');
const {Engine}=require('./engine');
let window,engine,current,plan,job,tempDir,output;
const resource=app.isPackaged?path.join(process.resourcesPath,'ffmpeg'):path.join(__dirname,'vendor');
function progress(stage,duration){return seconds=>window?.webContents.send('progress',{stage,percent:Math.max(0,Math.min(99,seconds/duration*100))});}
function register(name,fn){ipcMain.handle(name,async(event,...args)=>{
 if(event.sender!==window.webContents || event.senderFrame!==window.webContents.mainFrame)throw new Error('无效来源');
 try{return {ok:true,value:await fn(...args)};}catch(e){return {ok:false,error:e.name==='AbortError'?'操作已取消':e.message};}
});}
async function withJob(fn){if(job)throw new Error('请等待当前操作完成，或先取消。');job=new AbortController();try{return await fn(job.signal);}finally{job=null;}}
app.whenReady().then(async()=>{
 engine=new Engine(process.platform==='win32'?path.join(resource,'ffmpeg.exe'):'ffmpeg',process.platform==='win32'?path.join(resource,'ffprobe.exe'):'ffprobe');
 tempDir=await fs.mkdtemp(path.join(app.getPath('temp'),'qingcut-'));
 window=new BrowserWindow({width:1160,height:840,minWidth:760,minHeight:680,backgroundColor:'#101416',title:'轻剪 · 无损视频裁切',webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 window.removeMenu();window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',e=>e.preventDefault());
 register('open',()=>withJob(async()=>{
  const result=await dialog.showOpenDialog(window,{title:'打开 MP4 视频',properties:['openFile'],filters:[{name:'MP4 视频',extensions:['mp4','m4v','mov']}]});
  if(result.canceled)return null;
  const file=result.filePaths[0],meta=await engine.probe(file);
  current={file,meta};plan=null;output=null;
  return {...meta,name:path.basename(file),url:pathToFileURL(file).href};
 }));
 register('external',async()=>{
  if(!current)throw new Error('请先打开视频');
  const error=await shell.openPath(current.file);
  if(error)throw new Error('无法打开默认播放器：'+error);
 });
 register('keyframe',(position,direction)=>withJob(async signal=>{
  if(!current)throw new Error('请先打开视频');
  return engine.adjacentKey(current.file,position,direction,current.meta,signal);
 }));
 register('plan',(start,end)=>withJob(async signal=>{if(!current)throw new Error('请先打开视频');plan=await engine.plan(current.file,start,end,current.meta,signal);return plan;}));
 register('proxy',()=>withJob(async signal=>{
  if(!current)throw new Error('请先打开视频'); const dest=path.join(tempDir,require('node:crypto').randomUUID()+'.mp4');
  try{await engine.proxy(current.file,dest,{signal,onProgress:progress('正在生成兼容预览',current.meta.duration)});return pathToFileURL(dest).href;}catch(e){await fs.rm(dest,{force:true});throw e;}
 }));
 register('export',()=>withJob(async signal=>{
  if(!current||!plan)throw new Error('请先确认裁切范围');
  const result=await dialog.showSaveDialog(window,{title:'另存无损片段（请选择新文件名）',defaultPath:path.join(path.dirname(current.file),path.parse(current.file).name+'-cut.mp4'),filters:[{name:'MP4 视频',extensions:['mp4']}],properties:['createDirectory','showOverwriteConfirmation']});
  if(result.canceled)return null;
  const dest=result.filePath.toLowerCase().endsWith('.mp4')?result.filePath:result.filePath+'.mp4';
  await engine.cut(current.file,dest,plan,{signal,onProgress:progress('正在复制原始音视频',plan.end-plan.start)});output=dest;return path.basename(dest);
 }));
 register('cancel',()=>{job?.abort();});register('reveal',()=>{if(output)shell.showItemInFolder(output);});
 await window.loadFile('ui/index.html');
});
app.on('window-all-closed',()=>app.quit());
app.on('will-quit',()=>{engine?.stop();if(tempDir)require('node:fs').rmSync(tempDir,{recursive:true,force:true,maxRetries:3});});
