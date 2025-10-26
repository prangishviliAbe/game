Jungle Adventure — local run instructions

How to run

1. Open a terminal in this project folder (`c:\Users\Abe_P\Desktop\game`).
2. Start a simple HTTP server so the browser can load ES modules and textures:

PowerShell with Python:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Open in your browser:

http://127.0.0.1:8000

Controls

- Click Play, then click the canvas to lock the mouse.
- W/A/S/D to move. Mouse to look around.
- Collect fruits to increase your score.

About textures

The game attempts to load free textures from a public CDN (Three.js examples). You can also download example textures locally so the game uses them from `assets/textures/`.

Download example textures automatically

```powershell
.\scripts\download_textures.ps1
```

PBR placeholders and real textures

- I added a helper that prepares placeholder PBR textures (copies current example textures into `assets/textures/pbr/`) so the game can immediately use PBR-style maps. Run:

```powershell
.\scripts\prepare_pbr_placeholders.ps1
```

- After that, the game will look for PBR maps in `assets/textures/pbr/` with these filenames (you can replace them with real CC0 PBR textures later):

  - `bark_color.jpg`, `bark_normal.jpg`, `bark_roughness.jpg`
  - `leaf_albedo.png`, `leaf_alpha.png`, `leaf_normal.jpg`
  - `rock_color.jpg`, `rock_normal.jpg`, `rock_roughness.jpg`

- If you want high-quality CC0 PBR textures, tell me and I will fetch AmbientCG/Poly Haven 1k versions and place them in that folder (I can automate the download). If you prefer to provide your own files, just drop them into `assets/textures/pbr/` with the names above.

```

After running that script, start the server and the game will prefer the local textures.

Replacing textures

- Recommended formats: PNG (supports transparency) or JPG. Power-of-two sizes (256,512,1024) work best.

License

- This example contains code and links to example textures. If you want me to add higher-quality CC0 textures or GLTF tree models, tell me and I will fetch and integrate them.

- This example contains code and links to example textures. If you want me to add higher-quality CC0 textures or GLTF tree models, tell me and I will fetch and integrate them.
```
