const {spawn} = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
class Engine {
  constructor(ffmpeg='ffmpeg', ffprobe='ffprobe') { this.ffmpeg=ffmpeg; this.ffprobe=ffprobe; this.children=new Set(); }
  run(binary,args,{signal,onProgress,onLine}={}) {
    return new Promise((resolve,reject)=>{
      const child=spawn(binary,args,{windowsHide:true,signal}); this.children.add(child);
      let out='',err='',pending='';
      child.stdout.on('data',d=>{ if(onProgress||onLine){pending+=d; const lines=pending.split('\n');pending=lines.pop();for(const line of lines){if(onLine){onLine(line);continue;}const [k,v]=line.trim().split('=');if(k==='out_time_us')onProgress(Number(v)/1e6);}} else {out+=d; if(out.length>16*1024*1024)child.kill();} });
      child.stderr.on('data',d=>{err=(err+d).slice(-12000);});
      child.once('error',e=>reject(e));
      child.once('close',code=>{this.children.delete(child);if(onLine&&pending)onLine(pending);code===0?resolve(out):reject(new Error(signal?.aborted?'操作已取消':err || `无法运行 ${path.basename(binary)} (${code})`));});
    });
  }
  async probe(file) {
    const info=JSON.parse(await this.run(this.ffprobe,['-v','error','-show_format','-show_streams','-of','json',file]));
    const video=info.streams.find(s=>s.codec_type==='video' && !s.disposition?.attached_pic);
    const duration=Number(info.format.duration);
    if(!video || !Number.isFinite(duration) || duration<=0)throw new Error('文件没有可读取的视频轨道或时长。');
    return {duration,origin:Number(info.format.start_time)||0,codec:video.codec_name,width:video.width,height:video.height,pixelFormat:video.pix_fmt,bitrate:Number(info.format.bit_rate)||0,size:Number(info.format.size),streams:info.streams};
  }
  async keys(file,position,meta,signal) {
    // Demux only: no full-video decoding, and bounded memory even for long recordings.
    for(const span of [30,300,3600,meta.duration+1]){
      const from=Math.max(0,position-span),to=Math.min(meta.duration,position+span);
      let before,after;
      await this.run(this.ffprobe,['-v','error','-read_intervals',`${from+meta.origin}%${to+meta.origin}`,'-select_streams','v:0','-show_packets','-show_entries','packet=pts_time,flags','-of','csv=p=0',file],{signal,onLine:line=>{const parts=line.split(',');if(!parts[1]?.includes('K'))return;const t=Number(parts[0])-meta.origin;if(!Number.isFinite(t))return;if(t<=position+0.00001 && (before===undefined||t>before))before=t;if(t>=position-0.00001&&(after===undefined||t<after))after=t;}});
      if((before!==undefined || from===0) && (after!==undefined || to>=meta.duration))return {before:Math.max(0,before??0),after:Math.min(meta.duration,after??meta.duration)};
    }
    throw new Error('无法找到裁切边界的关键帧。');
  }
  async plan(file,start,end,meta,signal) {
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>meta.duration+0.001||end<=start)throw new Error('请设置有效的起点和终点。');
    const a=start===0?{before:0}:await this.keys(file,start,meta,signal);
    const b=end>=meta.duration-0.001?{after:meta.duration}:await this.keys(file,end,meta,signal);
    return {start:a.before,end:b.after,requestedStart:start,requestedEnd:end};
  }
  async cut(file,destination,plan,{signal,onProgress}={}) {
    const temp=path.join(path.dirname(destination),`.qingcut-${require('node:crypto').randomUUID()}.mp4`);
    try {
      await this.run(this.ffmpeg,['-hide_banner','-v','warning','-nostdin','-n','-ss',String(plan.start),'-i',file,'-t',String(plan.end-plan.start),'-map','0:v','-map','0:a?','-map_metadata','0','-map_chapters','-1','-c','copy','-avoid_negative_ts','make_zero','-movflags','+faststart','-progress','pipe:1',temp],{signal,onProgress});
      // Exclusive copy: never overwrite an existing file or the original, even after a race.
      signal?.throwIfAborted();
      await fs.copyFile(temp,destination,require('node:fs').constants.COPYFILE_EXCL);
      if(signal?.aborted){await fs.rm(destination,{force:true});signal.throwIfAborted();}
    } finally {await fs.rm(temp,{force:true});}
  }
  async proxy(file,destination,{signal,onProgress}={}) {
    await this.run(this.ffmpeg,['-hide_banner','-v','warning','-nostdin','-y','-i',file,'-map','0:v:0','-map','0:a:0?','-vf','scale=w=960:h=540:force_original_aspect_ratio=decrease:force_divisible_by=2','-c:v','libx264','-preset','ultrafast','-crf','25','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart','-progress','pipe:1',destination],{signal,onProgress});
  }
  stop(){for(const c of this.children)c.kill();}
}
module.exports={Engine};
