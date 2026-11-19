const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('cutApp',{
 external:()=>ipcRenderer.invoke('external'), keyframe:(position,direction)=>ipcRenderer.invoke('keyframe',position,direction),
 open:()=>ipcRenderer.invoke('open'), plan:(start,end)=>ipcRenderer.invoke('plan',start,end),
 export:()=>ipcRenderer.invoke('export'), proxy:()=>ipcRenderer.invoke('proxy'), cancel:()=>ipcRenderer.invoke('cancel'),
 reveal:()=>ipcRenderer.invoke('reveal'), onProgress:fn=>ipcRenderer.on('progress',(_,value)=>fn(value))
});
