const {spawn}=require('node:child_process');
class NativePlayer {
 constructor(exe,handle,onEvent){
  this.child=spawn(exe,[handle.readBigUInt64LE().toString()],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  let pending='',lastError='';this.ready=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{reject(new Error('内嵌播放器启动超时'));this.stop();},15000);
   this.child.once('error',e=>{clearTimeout(timer);reject(e);onEvent({type:'error',message:e.message});});
   this.child.once('exit',code=>{clearTimeout(timer);reject(new Error(lastError||'内嵌播放器已退出 ('+code+')'));onEvent({type:'exit'});});
   this.child.stdout.on('data',data=>{pending+=data;let i;while((i=pending.indexOf('\n'))>=0){const line=pending.slice(0,i);pending=pending.slice(i+1);try{const event=JSON.parse(line);if(event.type==='error'){lastError=event.message;clearTimeout(timer);reject(new Error(lastError));}if(event.type==='ready'){clearTimeout(timer);resolve();}onEvent(event);}catch{}}});
  });
  this.child.stderr.resume();this.child.stdin.on('error',()=>{});
 }
 send(message){if(this.child.exitCode!==null||this.child.killed)throw new Error('内嵌播放器未运行');this.child.stdin.write(JSON.stringify(message)+'\n');}
 stop(){this.child.stdin.end();const timer=setTimeout(()=>this.child.kill(),1500);timer.unref();}
}
module.exports={NativePlayer};
