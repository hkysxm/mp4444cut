$ErrorActionPreference = 'Stop'
$dest = Join-Path $PSScriptRoot '../vendor/mpv'
New-Item -ItemType Directory -Force $dest | Out-Null
$temp = Join-Path ([IO.Path]::GetTempPath()) ('qingcut-mpv-' + [guid]::NewGuid())
New-Item -ItemType Directory $temp | Out-Null
try {
    $archive = Join-Path $temp 'mpv.7z'
    Invoke-WebRequest 'https://github.com/shinchiro/mpv-winbuild-cmake/releases/download/20261111/mpv-dev-x86_64-20261111-git-bcde6b93cc.7z' -OutFile $archive
    if ((Get-FileHash $archive -Algorithm SHA256).Hash -ne '273c079b11ea5575822f972756f4c9a71149a5c10130353abeb8586738938452') { throw 'mpv SHA-256 mismatch' }
    & 7z x $archive "-o$dest" -y
    if ($LASTEXITCODE -ne 0) { throw 'mpv extraction failed' }
    if (!(Test-Path "$dest/libmpv-2.dll")) { throw 'libmpv-2.dll missing' }
    $csc = "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe"
    & $csc /nologo /target:exe /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll "/out:$dest/QingCut.Player.exe" "$PSScriptRoot/../native/Player.cs"
    if ($LASTEXITCODE -ne 0) { throw 'Native player compilation failed' }
    Copy-Item "$PSScriptRoot/../LICENSE" "$dest/QingCut-LICENSE.txt"
    @'
libmpv build: shinchiro/mpv-winbuild-cmake 20261111, mpv bcde6b93cc
Build scripts and source dependencies: https://github.com/shinchiro/mpv-winbuild-cmake/tree/20261111
mpv source and licensing: https://github.com/mpv-player/mpv/tree/bcde6b93cc
mpv is GPL-2.0-or-later; this application is GPL-3.0-or-later.
'@ | Set-Content "$dest/README-QingCut.txt"
} finally { Remove-Item $temp -Recurse -Force }
