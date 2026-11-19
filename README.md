# 轻剪 QingCut 1.0

Windows 10/11 x64 本地 MP4 无损裁切工具。解压整个发布包，双击 QingCut.exe；无需安装 Python、Node.js 或解码器。程序尚未代码签名。

## 使用
1. 打开 MP4（也可尝试 MOV / M4V）。
2. 播放 / 暂停，拖动进度条；点击“设为当前”选择起终点。也可输入 `00:01:23.500` 或秒数。
3. 如果无法播放，点击“生成兼容预览”。内置 FFmpeg 自动解码为低清 H.264 预览文件；耗时与片长、编码复杂度及 CPU 有关。可取消。临时预览存在系统临时目录，正常退出时清理。
4. 点击“无损裁切”，查看关键帧对齐后的范围，选择一个新的文件名保存。不会覆盖已有文件。

## 内嵌原生播放（Windows x64）
Windows 默认通过随包 libmpv 在应用内直接播放原片，不需要先生成兼容预览。原生子窗口嵌入视频区域，播放时间、播放/暂停、时间轴和关键帧跳转同步；全屏、窗口尺寸变化也会调整视频区域。优先尝试安全的硬件解码，不支持的格式由 mpv 回退到软件解码。实际硬解能力依赖显卡、驱动和素材，不能保证所有 HEVC 4:2:2 / 10-bit 组合都能硬解。

“生成兼容预览”仍可作为备用，会切换回网页播放器；“本地播放器”是独立外部窗口的备用入口。macOS/Linux 仍使用原有网页预览。

原生桥接源码位于 `native/Player.cs`，使用 Windows .NET Framework 4.x / WinForms。`scripts/setup-mpv.ps1` 下载固定版本 libmpv 并验证供应方 GitHub Release 的 SHA-256，编译桥接程序。播放器随 ZIP 放在 `resources/ffmpeg/mpv`，用户无需另装 mpv。mpv 为 GPL-2.0-or-later，构建及源码信息随包提供。

Windows CI 额外验证 libmpv 实际加载 HEVC、精确跳转、播放时间推进和暂停同步；Linux 会明确跳过该原生测试。显卡硬解性能、HDR 显示以及多屏 DPI 仍需 Windows 实机验证。

## 播放与定位
- “本地播放器”调用系统默认播放器打开原片，省去兼容预览转码。Windows 可将 MPC-HC、MPC-BE 或其他支持 HEVC 的播放器设为默认；madVR 是播放器使用的渲染器。外部窗口的播放位置不会同步回轻剪，需在轻剪时间轴或时间输入框设置裁切范围。
- “◀ 关键帧 / 关键帧 ▶”点按跳到相邻关键帧，长按连续跳转，松开或窗口失焦即停止。定位读取原片关键帧，不进行整片解码；无法内嵌播放时仍可调整时间，查看画面需生成兼容预览。
- “全屏”将视频预览放大，保留播放、定位、起终点、裁切和状态控件；点击“退出全屏”或按 Esc 返回。

## 无损的含义与兼容边界
- 导出使用 FFmpeg `-c copy`，音视频压缩数据不重新编码；不限制输入码率，不将整部视频装入内存。大文件受磁盘速度和剩余空间影响。导出采用临时文件和独占复制，需要约两倍输出大小的可用磁盘空间。
- 起点向前、终点向后扩展到关键帧。不支持任意帧精确裁切；B 帧重排序和音频包时长可能造成实际播放时长略有差异。
- 保留全部视频和音频轨道及 FFmpeg 可复制的通用元数据。字幕、章节、厂商私有数据轨道和完整相机侧车元数据不在保留保证内。并非字节级完整文件复制。
- H.264、HEVC（含 10-bit）由 FFmpeg 支持；4:2:2、高分辨率、高帧率素材通常需要软件解码预览。预览可能不能准确显示 HDR / Log / Dolby Vision 色彩；预览副本不用于导出。
- 手机可变帧率、旋转信息、特殊 HDR 附加数据和相机专有 MP4 组合需样片验证。无法承诺所有厂商组合可用。
- 没有取得用户所指的 a7R6 最高码率原片，不宣称已验证该机型。设计没有码率上限，但具体兼容性取决于编码与封装，不能只凭 .mp4 后缀判断。
- 当前交付 Windows x64 版；不提供 Android / iOS / macOS 成品。不采用浏览器 WASM 裁切，避免大型视频的内存与移动端限制。
- 运行期间无需网络，视频不上传。内置解码器已经下载并随发布包附带，不依赖浏览器插件。

## 验证
Linux 上使用系统 FFmpeg 运行 `npm test`：H.264、HEVC 10-bit、双音轨；逐个比较导出压缩包 SHA-256，验证所有输出包均来自原片；验证导出可解码、无覆盖、取消清理、HEVC 兼容预览。界面在 Linux Electron 上检查。Windows 发布包在 Linux 交叉打包；没有 Windows 实机运行验证，也没有相机最高码率样片验证。

## 开发
Node.js 22+，`npm ci`。Linux/macOS 开发需系统安装 FFmpeg 与 ffprobe；Windows 先在 PowerShell 运行 `./scripts/setup-ffmpeg.ps1` 和 `./scripts/setup-mpv.ps1`（需要 7-Zip 与系统 .NET Framework 4.x 编译器），下载并校验 `vendor/ffmpeg.exe` 和 `vendor/ffprobe.exe`。这两个大文件不放入 Git 历史，发布包仍内置解码器。运行 `npm start`，测试 `npm test`，打包 `npm run build:win`。

## 第三方软件
本项目 GPL-3.0-or-later，完整许可见 LICENSE。Electron 40.10.6 为 MIT，附带 Chromium 等第三方声明（发布目录 LICENSE.electron.txt / LICENSES.chromium.html）。
内置 FFmpeg 来自 https://www.gyan.dev/ffmpeg/builds/ ，版本、源码链接、构建配置及 GPL 许可位于 resources/ffmpeg/README.txt 和 LICENSE；开发目录为 vendor。二进制未经修改，ffplay 未包含。源码及构建资料可从上述供应方取得。
