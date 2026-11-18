# 轻剪 QingCut 1.0

Windows 10/11 x64 本地 MP4 无损裁切工具。解压整个发布包，双击 QingCut.exe；无需安装 Python、Node.js 或解码器。程序尚未代码签名。

## 使用
1. 打开 MP4（也可尝试 MOV / M4V）。
2. 播放 / 暂停，拖动进度条；点击“设为当前”选择起终点。也可输入 `00:01:23.500` 或秒数。
3. 如果无法播放，点击“生成兼容预览”。内置 FFmpeg 自动解码为低清 H.264 预览文件；耗时与片长、编码复杂度及 CPU 有关。可取消。临时预览存在系统临时目录，正常退出时清理。
4. 点击“无损裁切”，查看关键帧对齐后的范围，选择一个新的文件名保存。不会覆盖已有文件。

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
Node.js 22+，`npm ci`。Linux/macOS 开发需系统安装 FFmpeg 与 ffprobe；Windows 先在 PowerShell 运行 `./scripts/setup-ffmpeg.ps1`，下载并校验 `vendor/ffmpeg.exe` 和 `vendor/ffprobe.exe`。这两个大文件不放入 Git 历史，发布包仍内置解码器。运行 `npm start`，测试 `npm test`，打包 `npm run build:win`。

## 第三方软件
本项目 GPL-3.0-or-later，完整许可见 LICENSE。Electron 40.10.6 为 MIT，附带 Chromium 等第三方声明（发布目录 LICENSE.electron.txt / LICENSES.chromium.html）。
内置 FFmpeg 来自 https://www.gyan.dev/ffmpeg/builds/ ，版本、源码链接、构建配置及 GPL 许可位于 resources/ffmpeg/README.txt 和 LICENSE；开发目录为 vendor。二进制未经修改，ffplay 未包含。源码及构建资料可从上述供应方取得。
