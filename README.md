# Jungle Adventure (browser) 🏞️

Immersive 3D jungle adventure featuring realistic human characters and dynamic environments built with Three.js.

**🎮 Features:**

- Realistic 3D human characters (Metacreators model)
- Interactive ducks with swimming/walking animations
- Dynamic weather system with rain
- Interactive fruit collection gameplay
- Built-in scene editor
- PBR materials and advanced lighting
- Multiple tree types and environmental details

**👥 Character Models:**

- **Humans**: High-quality Metacreators base human model with advanced animations
- **Ducks**: Realistic animated duck models with swimming behavior

**🌟 Visual Quality:**

- Physically Based Rendering (PBR)
- Dynamic shadows and lighting
- Atmospheric effects and weather
- Realistic water with reflections
- Procedurally generated vegetation

How to run locally

Prerequisites: a modern browser and either Python or Node.js (for a quick static server).

Run a local server from the project root:

```powershell
# Python 3
python -m http.server 8000 --bind 127.0.0.1

# or (Windows)
py -m http.server 8000 --bind 127.0.0.1

# or fallback using npm
npx http-server -c-1 -p 8000
```

Open http://127.0.0.1:8000 in your browser and press Start.

Notes

- Textures are stored in `assets/textures/pbr/` and were fetched from CC0 AmbientCG packs.
- If you add or replace textures, refresh the page and clear cache (Ctrl+F5) to see changes.

GitHub Pages demo

- This repository includes a GitHub Actions workflow that publishes the repository root to GitHub Pages automatically on pushes to `main`.
- Allow a minute or two after pushing for the Pages deployment to finish.

License

- The game code in this repository is provided under the MIT license. Check upstream texture licenses (AmbientCG) for usage rules (they are typically CC0/CC-BY).
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
