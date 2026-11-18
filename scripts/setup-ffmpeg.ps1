# Download the same FFmpeg build used by QingCut 1.0.0; verify each binary.
$ErrorActionPreference = 'Stop'
$vendorPath = Join-Path $PSScriptRoot '../vendor'
$tempPath = Join-Path ([IO.Path]::GetTempPath()) ('qingcut-' + [guid]::NewGuid())
New-Item -ItemType Directory -Force -Path $vendorPath, $tempPath | Out-Null
try {
    $archivePath = Join-Path $tempPath 'ffmpeg.zip'
    Invoke-WebRequest -Uri 'https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-9.0.2-essentials_build.zip' -OutFile $archivePath
    Expand-Archive -LiteralPath $archivePath -DestinationPath $tempPath
    $expected = @{
        'ffmpeg.exe' = '3256173f3f8bffd7df12227c68adf68025edb1832273a9530688a7bb1ed8edec'
        'ffprobe.exe' = 'f0d36ecbbdd3bcfac3efa078c96c7271c2e68b3810595552ac3b7f17e9a65c52'
    }
    foreach ($name in $expected.Keys) {
        $files = @(Get-ChildItem -Path $tempPath -Recurse -File -Filter $name)
        if ($files.Count -ne 1) { throw "Expected exactly one $name" }
        if ((Get-FileHash -LiteralPath $files[0].FullName -Algorithm SHA256).Hash -ne $expected[$name]) {
            throw "SHA256 mismatch for $name; refusing to install."
        }
    }
    foreach ($name in $expected.Keys) {
        $file = Get-ChildItem -Path $tempPath -Recurse -File -Filter $name
        Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $vendorPath $name)
    }
    Write-Host 'FFmpeg and ffprobe downloaded and verified.'
} finally {
    Remove-Item -LiteralPath $tempPath -Recurse -Force
}
