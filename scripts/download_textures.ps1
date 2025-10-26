# Create assets/textures and download example textures (Three.js examples)
$target = Join-Path -Path $PSScriptRoot -ChildPath "..\assets\textures"
if (-not (Test-Path $target)) {
    New-Item -ItemType Directory -Path $target | Out-Null
}

$files = @(
    @{ url = 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg'; out = 'grasslight-big.jpg' },
    @{ url = 'https://threejs.org/examples/textures/uv_grid_opengl.jpg'; out = 'uv_grid_opengl.jpg' },
    @{ url = 'https://threejs.org/examples/textures/sprites/ball.png'; out = 'ball.png' }
)

foreach ($f in $files) {
    $outPath = Join-Path $target $f.out
    Write-Host "Downloading $($f.url) -> $outPath"
    try {
        Invoke-WebRequest -Uri $f.url -OutFile $outPath -UseBasicParsing -ErrorAction Stop
        Write-Host "Saved: $outPath"
    }
    catch {
        Write-Warning "Failed to download $($f.url): $_"
    }
}

Write-Host "Done. Start the server and open http://127.0.0.1:8000"
