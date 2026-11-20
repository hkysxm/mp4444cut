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
    # libmpv imports vulkan-1.dll even when D3D11/software rendering is used.
    # Build the redistributable loader from pinned Khronos sources; do not require a GPU SDK.
    foreach ($repo in @(
        @{ Name = 'Vulkan-Headers'; Commit = '6802bb4733b63ed5efd3adb308a6c885ef180ea1' },
        @{ Name = 'Vulkan-Loader'; Commit = 'fa218055ff4948b159f31d43f800c808a13d51df' }
    )) {
        $src = Join-Path $temp $repo.Name
        git init $src
        git -C $src fetch --depth 1 "https://github.com/KhronosGroup/$($repo.Name).git" $repo.Commit
        if ($LASTEXITCODE -ne 0) { throw 'Khronos source download failed' }
        git -C $src checkout --detach FETCH_HEAD
        if ($LASTEXITCODE -ne 0) { throw 'Khronos checkout failed' }
    }
    $prefix = Join-Path $temp 'installed'
    cmake -S "$temp/Vulkan-Headers" -B "$temp/headers-build" -A x64 "-DCMAKE_INSTALL_PREFIX=$prefix"
    if ($LASTEXITCODE -ne 0) { throw 'Vulkan headers configure failed' }
    cmake --install "$temp/headers-build" --config Release
    if ($LASTEXITCODE -ne 0) { throw 'Vulkan headers install failed' }
    cmake -S "$temp/Vulkan-Loader" -B "$temp/loader-build" -A x64 "-DCMAKE_PREFIX_PATH=$prefix" -DBUILD_TESTS=OFF -DBUILD_WERROR=OFF
    if ($LASTEXITCODE -ne 0) { throw 'Vulkan loader configure failed' }
    cmake --build "$temp/loader-build" --config Release --parallel 2
    if ($LASTEXITCODE -ne 0) { throw 'Vulkan loader build failed' }
    $dll = @(Get-ChildItem "$temp/loader-build" -Recurse -Filter vulkan-1.dll)
    if ($dll.Count -ne 1) { throw 'Expected one Vulkan loader DLL' }
    Copy-Item $dll[0].FullName "$dest/vulkan-1.dll"
    Copy-Item "$temp/Vulkan-Loader/LICENSE.txt" "$dest/Vulkan-Loader-LICENSE.txt"
    $csc = "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe"
    $source = (Resolve-Path (Join-Path $PSScriptRoot "../native/Player.cs")).Path
    $output = Join-Path (Resolve-Path $dest).Path "QingCut.Player.exe"
    & $csc /nologo /target:exe /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll "/out:$output" $source
    if ($LASTEXITCODE -ne 0) { throw 'Native player compilation failed' }
    Copy-Item "$PSScriptRoot/../LICENSE" "$dest/QingCut-LICENSE.txt"
    @'
libmpv build: shinchiro/mpv-winbuild-cmake 20261111, mpv bcde6b93cc
Build scripts and source dependencies: https://github.com/shinchiro/mpv-winbuild-cmake/tree/20261111
mpv source and licensing: https://github.com/mpv-player/mpv/tree/bcde6b93cc
mpv is GPL-2.0-or-later; this application is GPL-3.0-or-later.
'@ | Set-Content "$dest/README-QingCut.txt"
} finally { Remove-Item $temp -Recurse -Force }
