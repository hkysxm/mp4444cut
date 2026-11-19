using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Globalization;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Collections.Generic;
using System.Windows.Forms;

// A real WS_CHILD video surface. All libmpv calls run on the UI thread.
class Player : Form {
 [DllImport("user32.dll")] static extern IntPtr SetParent(IntPtr child, IntPtr parent);
 [DllImport("user32.dll")] static extern int SetWindowLong(IntPtr h, int index, int value);
 [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
 [DllImport("libmpv-2.dll", CallingConvention=CallingConvention.Cdecl)] static extern IntPtr mpv_create();
 [DllImport("libmpv-2.dll", CallingConvention=CallingConvention.Cdecl)] static extern int mpv_initialize(IntPtr ctx);
 [DllImport("libmpv-2.dll", CallingConvention=CallingConvention.Cdecl)] static extern int mpv_set_option_string(IntPtr ctx, byte[] name, byte[] value);
 [DllImport("libmpv-2.dll", CallingConvention=CallingConvention.Cdecl)] static extern int mpv_command(IntPtr ctx, IntPtr args);
 [DllImport("libmpv-2.dll", CallingConvention=CallingConvention.Cdecl)] static extern IntPtr mpv_get_property_string(IntPtr ctx, byte[] name);
 [DllImport("libmpv-2.dll", CallingConvention=CallingConvention.Cdecl)] static extern void mpv_free(IntPtr value);
 [DllImport("libmpv-2.dll", CallingConvention=CallingConvention.Cdecl)] static extern void mpv_terminate_destroy(IntPtr ctx);
 [StructLayout(LayoutKind.Sequential)] struct MpvEvent {public int id;public int error;public ulong user;public IntPtr data;}
 [DllImport("libmpv-2.dll", CallingConvention=CallingConvention.Cdecl)] static extern IntPtr mpv_wait_event(IntPtr ctx,double timeout);
 IntPtr mpv;
 readonly JavaScriptSerializer json=new JavaScriptSerializer();
 readonly ConcurrentQueue<string> queue=new ConcurrentQueue<string>();
 readonly System.Windows.Forms.Timer timer=new System.Windows.Forms.Timer();
 static byte[] Utf(string s){return Encoding.UTF8.GetBytes(s+"\0");}
 void Send(object o){Console.WriteLine(json.Serialize(o));Console.Out.Flush();}
 void Option(string name,string value){if(mpv_set_option_string(mpv,Utf(name),Utf(value))<0)throw new Exception("mpv option: "+name);}
 string Property(string name){IntPtr p=mpv_get_property_string(mpv,Utf(name));if(p==IntPtr.Zero)return null;try{return Marshal.PtrToStringAnsi(p);}finally{mpv_free(p);}}
 void Command(params string[] args){
  IntPtr[] strings=new IntPtr[args.Length];IntPtr array=Marshal.AllocHGlobal((args.Length+1)*IntPtr.Size);
  try {for(int i=0;i<args.Length;i++){byte[] b=Utf(args[i]);strings[i]=Marshal.AllocHGlobal(b.Length);Marshal.Copy(b,0,strings[i],b.Length);Marshal.WriteIntPtr(array,i*IntPtr.Size,strings[i]);}Marshal.WriteIntPtr(array,args.Length*IntPtr.Size,IntPtr.Zero);if(mpv_command(mpv,array)<0)throw new Exception("mpv command failed: "+args[0]);}
  finally{foreach(IntPtr p in strings)if(p!=IntPtr.Zero)Marshal.FreeHGlobal(p);Marshal.FreeHGlobal(array);}
 }
 Player(long parent){
  if(parent==0){var testParent=new Form();testParent.Show();parent=testParent.Handle.ToInt64();}
  FormBorderStyle=FormBorderStyle.None;ShowInTaskbar=false;BackColor=System.Drawing.Color.Black;
  SetParent(Handle,new IntPtr(parent));SetWindowLong(Handle,-16,unchecked((int)0x50000000));
  mpv=mpv_create();if(mpv==IntPtr.Zero)throw new Exception("Cannot create mpv");
  Option("wid",Handle.ToInt64().ToString());Option("config","no");Option("load-scripts","no");Option("terminal","no");Option("hwdec","auto-safe");Option("keep-open","yes");Option("idle","yes");Option("pause","yes");Option("input-default-bindings","no");Option("osc","no");
  if(mpv_initialize(mpv)<0)throw new Exception("Cannot initialize mpv");
  timer.Interval=80;timer.Tick+=(s,e)=>Tick();timer.Start();
  new Thread(()=>{string line;while((line=Console.ReadLine())!=null)queue.Enqueue(line);queue.Enqueue("{\"op\":\"quit\"}");}){IsBackground=true}.Start();
  Send(new {type="ready"});
 }
 void Tick(){
  string line;
  while(queue.TryDequeue(out line))try{
   var m=json.Deserialize<Dictionary<string,object>>(line);string op=(string)m["op"];
   if(op=="quit"){Close();return;}
   if(op=="bounds"){SetBounds(Convert.ToInt32(m["x"]),Convert.ToInt32(m["y"]),Math.Max(1,Convert.ToInt32(m["width"])),Math.Max(1,Convert.ToInt32(m["height"])));Visible=Convert.ToBoolean(m["visible"]);}
   if(op=="load"){Command("loadfile",(string)m["file"],"replace");Command("set","pause","yes");}
   if(op=="pause")Command("set","pause",Convert.ToBoolean(m["value"])?"yes":"no");
   if(op=="seek"){Command("set","pause","yes");Command("seek",Convert.ToDouble(m["time"]).ToString(CultureInfo.InvariantCulture),"absolute+exact");}
   Send(new {type="ack",id=m.ContainsKey("id")?m["id"]:null});
  }catch(Exception ex){Send(new {type="error",message=ex.Message});}
  for(int i=0;i<100;i++){
   var evt=(MpvEvent)Marshal.PtrToStructure(mpv_wait_event(mpv,0),typeof(MpvEvent));
   if(evt.id==0)break;
   if(evt.id==7&&evt.data!=IntPtr.Zero&&Marshal.ReadInt32(evt.data)==4)Send(new {type="error",message="原片解码失败，可使用兼容预览"});
  }
  double t; if(double.TryParse(Property("time-pos"),NumberStyles.Float,CultureInfo.InvariantCulture,out t))Send(new {type="state",time=t,paused=Property("pause")=="yes"});
 }
 protected override void OnFormClosed(FormClosedEventArgs e){timer.Stop();if(mpv!=IntPtr.Zero){mpv_terminate_destroy(mpv);mpv=IntPtr.Zero;}base.OnFormClosed(e);}
 [STAThread] static void Main(string[] args){try{Console.InputEncoding=Encoding.UTF8;Console.OutputEncoding=new UTF8Encoding(false);SetProcessDPIAware();Application.Run(new Player(long.Parse(args[0])));}catch(Exception e){Console.WriteLine(new JavaScriptSerializer().Serialize(new {type="error",message=e.Message}));Environment.ExitCode=1;}}
}
