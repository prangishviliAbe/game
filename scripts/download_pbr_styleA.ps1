# Download PBR placeholders for Style A (tropical)
# This script downloads a small set of placeholder textures into assets/textures/pbr/
# It prefers stable Three.js example assets as safe defaults, and falls back to copying from assets/textures/ if present.

$targetDir = "assets/textures/pbr"
if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir | Out-Null }

$files = @(
    @{ name = 'bark_color.jpg'; url = 'https://threejs.org/examples/textures/uv_grid_opengl.jpg' },
    @{ name = 'bark_normal.jpg'; url = 'https://threejs.org/examples/textures/uv_grid_opengl.jpg' },
    @{ name = 'bark_roughness.jpg'; url = 'https://threejs.org/examples/textures/uv_grid_opengl.jpg' },
    @{ name = 'leaf_albedo.png'; url = 'https://threejs.org/examples/textures/sprites/ball.png' },
    @{ name = 'leaf_alpha.png'; url = 'https://threejs.org/examples/textures/sprites/ball.png' },
    @{ name = 'leaf_normal.jpg'; url = 'https://threejs.org/examples/textures/uv_grid_opengl.jpg' },
    @{ name = 'rock_color.jpg'; url = 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg' },
    @{ name = 'rock_normal.jpg'; url = 'https://threejs.org/examples/textures/uv_grid_opengl.jpg' },
    @{ name = 'rock_roughness.jpg'; url = 'https://threejs.org/examples/textures/uv_grid_opengl.jpg' }
)

foreach ($f in $files) {
    $outPath = Join-Path $targetDir $f.name
    Write-Host "Downloading $($f.name) -> $outPath"
    try {
        Invoke-WebRequest -Uri $f.url -OutFile $outPath -UseBasicParsing -ErrorAction Stop
        Write-Host "  OK"
    }
    catch {
        Write-Warning "  Failed to download $($f.url) — attempting local fallback"
        # try to copy from assets/textures if a similarly-named file exists
        $localCandidates = @("assets/textures/$($f.name)", "assets/textures/uv_grid_opengl.jpg", "assets/textures/grasslight-big.jpg", "assets/textures/ball.png")
        $copied = $false
        foreach ($c in $localCandidates) {
            if (Test-Path $c) {
                Copy-Item -Path $c -Destination $outPath -Force
                Write-Host "  Copied local $c -> $outPath"
                $copied = $true
                break
            }
        }
        if (-not $copied) { Write-Warning "  No local fallback found for $($f.name)" }
    }
}

Write-Host ("Listing files in {0}:" -f $targetDir)
Get-ChildItem -Path $targetDir | Select-Object Name, Length | Format-Table -AutoSize
