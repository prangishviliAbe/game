<#
Copies existing example textures into a pbr/ folder as placeholders.
Run this to populate `assets/textures/pbr/` with usable files which you can later replace with real PBR maps.
#>
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$assets = Join-Path $root "..\assets\textures"
$pbr = Join-Path $assets "pbr"
if (-not (Test-Path $pbr)) { New-Item -ItemType Directory -Path $pbr | Out-Null }

function Copy-IfExists($src, $dest) {
    $s = Join-Path $assets $src
    if (Test-Path $s) {
        Copy-Item $s -Destination (Join-Path $pbr $dest) -Force
        Write-Host "Copied $s -> $dest"
    }
    else {
        Write-Warning "Missing source: $s"
    }
}

Copy-IfExists 'uv_grid_opengl.jpg' 'bark_color.jpg'
Copy-IfExists 'uv_grid_opengl.jpg' 'bark_normal.jpg'
Copy-IfExists 'uv_grid_opengl.jpg' 'bark_roughness.jpg'

Copy-IfExists 'ball.png' 'leaf_albedo.png'
Copy-IfExists 'ball.png' 'leaf_alpha.png'

Copy-IfExists 'grasslight-big.jpg' 'rock_color.jpg'
Copy-IfExists 'grasslight-big.jpg' 'rock_normal.jpg'
Copy-IfExists 'grasslight-big.jpg' 'rock_roughness.jpg'

Write-Host "PBR placeholder preparation complete. Replace files in assets/textures/pbr/ with real PBR textures when available."
