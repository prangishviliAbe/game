# Download selected AmbientCG 1K PBR zips and extract PBR maps into assets/textures/pbr/
# Picks: Wood050 (bark), Leaf001 (leaf), Rocks011 (rock) at 1K JPG packs

$target = "assets/textures/pbr"
if (-not (Test-Path $target)) { New-Item -ItemType Directory -Path $target | Out-Null }

$temp = Join-Path $env:TEMP "ambientcg_download_$(Get-Random)"
if (Test-Path $temp) { Remove-Item $temp -Recurse -Force }
New-Item -ItemType Directory -Path $temp | Out-Null

$assets = @(
    @{ id = 'Wood050'; url = 'https://ambientcg.com/get?file=Wood050_1K-JPG.zip' },
    @{ id = 'Leaf001'; url = 'https://ambientcg.com/get?file=Leaf001_1K-JPG.zip' },
    @{ id = 'Rocks011'; url = 'https://ambientcg.com/get?file=Rocks011_1K-JPG.zip' }
)

Write-Host "Downloading ${($assets.Count)} AmbientCG packages to $temp"

foreach ($a in $assets) {
    $zipPath = Join-Path $temp ("$($a.id).zip")
    Write-Host "Downloading $($a.id) -> $zipPath"
    try {
        Invoke-WebRequest -Uri $a.url -OutFile $zipPath -UseBasicParsing -ErrorAction Stop
        Write-Host "  Downloaded"

        $extractDir = Join-Path $temp $a.id
        Expand-Archive -LiteralPath $zipPath -DestinationPath $extractDir -Force
        Write-Host "  Extracted to $extractDir"

        # Find candidate files
        $files = Get-ChildItem -Path $extractDir -Recurse -File | Where-Object { $_.Extension -match '\.(jpg|jpeg|png)$' }
        foreach ($f in $files) { Write-Host "    Found: $($f.Name)" }

        # helper to find best match
        function FindFile([string]$pattern) {
            $p = $files | Where-Object { $_.Name -match $pattern } | Select-Object -First 1
            return $p
        }

        if ($a.id -like 'Wood*') {
            $albedo = FindFile('(?i)albedo|basecolor|diffuse|color')
            $normal = FindFile('(?i)normal')
            $rough = FindFile('(?i)roughness|specular|gloss')
            if ($albedo) { Copy-Item $albedo.FullName (Join-Path $target 'bark_color.jpg') -Force; Write-Host "  Copied bark_color -> $($albedo.Name)" }
            if ($normal) { Copy-Item $normal.FullName (Join-Path $target 'bark_normal.jpg') -Force; Write-Host "  Copied bark_normal -> $($normal.Name)" }
            if ($rough) { Copy-Item $rough.FullName (Join-Path $target 'bark_roughness.jpg') -Force; Write-Host "  Copied bark_roughness -> $($rough.Name)" }
        }
        elseif ($a.id -like 'Leaf*' -or $a.id -like 'Foliage*' -or $a.id -like 'Leaves*') {
            $albedo = FindFile('(?i)albedo|basecolor|diffuse|color')
            $alpha = FindFile('(?i)alpha|opacity|transparency')
            $normal = FindFile('(?i)normal')
            if ($albedo) { Copy-Item $albedo.FullName (Join-Path $target 'leaf_albedo.png') -Force; Write-Host "  Copied leaf_albedo -> $($albedo.Name)" }
            if ($alpha) { Copy-Item $alpha.FullName (Join-Path $target 'leaf_alpha.png') -Force; Write-Host "  Copied leaf_alpha -> $($alpha.Name)" }
            if ($normal) { Copy-Item $normal.FullName (Join-Path $target 'leaf_normal.jpg') -Force; Write-Host "  Copied leaf_normal -> $($normal.Name)" }
        }
        elseif ($a.id -like 'Rocks*' -or $a.id -like 'Rock*') {
            $albedo = FindFile('(?i)albedo|basecolor|diffuse|color')
            $normal = FindFile('(?i)normal')
            $rough = FindFile('(?i)roughness|specular|gloss')
            if ($albedo) { Copy-Item $albedo.FullName (Join-Path $target 'rock_color.jpg') -Force; Write-Host "  Copied rock_color -> $($albedo.Name)" }
            if ($normal) { Copy-Item $normal.FullName (Join-Path $target 'rock_normal.jpg') -Force; Write-Host "  Copied rock_normal -> $($normal.Name)" }
            if ($rough) { Copy-Item $rough.FullName (Join-Path $target 'rock_roughness.jpg') -Force; Write-Host "  Copied rock_roughness -> $($rough.Name)" }
        }

    }
    catch {
        Write-Warning "Failed to download or extract $($a.id): $_"
    }
}

Write-Host "Cleanup temp folder"
# Optionally remove temp
Remove-Item -Path $temp -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Done. Listing files in $target"
Get-ChildItem -Path $target | Select-Object Name, Length | Format-Table -AutoSize
