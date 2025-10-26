import * as THREE from 'three';
import { PointerLockControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/PointerLockControls.js';

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background
scene.fog = new THREE.Fog(0x87CEEB, 50, 200); // Add fog for depth

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game-canvas'), antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// Newer Three.js versions removed outputEncoding; prefer outputColorSpace when available.
if ('outputColorSpace' in renderer) {
    // Use SRGB color space if present, otherwise fall back to sRGBEncoding constant
    const sRGB = (THREE.SRGBColorSpace !== undefined) ? THREE.SRGBColorSpace : (THREE.sRGBEncoding !== undefined ? THREE.sRGBEncoding : undefined);
    if (sRGB !== undefined) renderer.outputColorSpace = sRGB;
} else if ('outputEncoding' in renderer && THREE.sRGBEncoding !== undefined) {
    renderer.outputEncoding = THREE.sRGBEncoding;
}

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
scene.add(ambientLight);

// Sun (warm directional light) with sharper shadows
const directionalLight = new THREE.DirectionalLight(0xfff1c1, 1.0);
directionalLight.position.set(80, 120, 50);
directionalLight.castShadow = true;
// Increase shadow map size for crisper shadows
directionalLight.shadow.mapSize.width = 4096;
directionalLight.shadow.mapSize.height = 4096;
// Configure shadow camera (orthographic) to cover the play area
const d = 120;
directionalLight.shadow.camera.left = -d;
directionalLight.shadow.camera.right = d;
directionalLight.shadow.camera.top = d;
directionalLight.shadow.camera.bottom = -d;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 400;
directionalLight.shadow.bias = -0.0005;
// radius softening (supported in some browsers / drivers)
if ('radius' in directionalLight.shadow) directionalLight.shadow.radius = 4;
scene.add(directionalLight);

// Hemisphere fill for ambient blue sky and warm ground bounce
const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x444444, 0.5);
scene.add(hemiLight);

// Sun visual: small emissive sphere to represent the sun position
const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff1a8 });
const sunGeo = new THREE.SphereGeometry(6, 12, 12);
const sunMesh = new THREE.Mesh(sunGeo, sunMat);
sunMesh.position.copy(directionalLight.position);
sunMesh.renderOrder = 999;
scene.add(sunMesh);

// Player character
const playerGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
const playerMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
const player = new THREE.Mesh(playerGeometry, playerMaterial);
player.position.set(0, 1, 0);
player.castShadow = true;
scene.add(player);

// Camera / controls setup (we use pointer lock for immersive adventure)
camera.position.set(0, 2, 0); // camera height relative to player
const controls = new PointerLockControls(camera, renderer.domElement);
// We won't add the control object to the scene (camera is enough). The player mesh remains visible and will be synced to camera.

// Start screen / pointer lock hookup
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');
if (startButton) {
    startButton.addEventListener('click', () => {
        // Initialize audio on user gesture
        initAudio();
        if (audioContext && audioContext.state === 'suspended') audioContext.resume();
        controls.lock();
    });
}

controls.addEventListener('lock', () => {
    if (startScreen) startScreen.style.display = 'none';
});
controls.addEventListener('unlock', () => {
    if (startScreen) startScreen.style.display = 'flex';
});

// Ground with procedural texture
// Texture loader (we attempt to load free textures from public URLs; fall back to plain color if unavailable)
const loader = new THREE.TextureLoader();
let groundTex = null;
let barkTex = null;
let leavesTex = null;
// PBR maps (optional) - will be loaded from assets/textures/pbr/ if present
let barkColor = null, barkNormal = null, barkRoughness = null;
let leafAlbedo = null, leafAlpha = null, leafNormal = null;
let rockColor = null, rockNormal = null, rockRoughness = null;
// Keep references to created meshes so we can apply textures after async load
const trunkMeshes = [];
const leafMeshes = [];
const rockMeshes = [];

// Procedural helper: create a soft cloud texture using canvas (used as fallback)
function createCloudCanvasTexture(size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    // clear
    ctx.clearRect(0, 0, size, size);
    // radial gradient for a soft blob
    const grad = ctx.createRadialGradient(size/2, size/2, size*0.05, size/2, size/2, size*0.6);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.6, 'rgba(245,245,245,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

// Procedural helper: create a simple leaf-shaped texture (alpha) via canvas
function createLeafCanvasTexture(w = 256, h = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    // draw a leaf shape
    ctx.translate(w/2, h/2);
    ctx.rotate(-Math.PI/6);
    ctx.scale(1, 0.9);
    ctx.beginPath();
    ctx.moveTo(-w*0.2, 0);
    ctx.quadraticCurveTo(-w*0.5, -h*0.4, 0, -h*0.45);
    ctx.quadraticCurveTo(w*0.5, -h*0.4, w*0.2, 0);
    ctx.quadraticCurveTo(w*0.1, h*0.35, 0, h*0.45);
    ctx.quadraticCurveTo(-w*0.1, h*0.35, -w*0.2, 0);
    const grad = ctx.createLinearGradient(-w*0.2, -h*0.4, w*0.2, h*0.4);
    grad.addColorStop(0, '#2e8b57');
    grad.addColorStop(1, '#4caf50');
    ctx.fillStyle = grad;
    ctx.fill();
    // subtle stroke
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(30,80,30,0.6)';
    ctx.stroke();
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

// Create procedural fallbacks now
const proceduralCloudTex = createCloudCanvasTexture(512);
const proceduralLeafTex = createLeafCanvasTexture(256, 256);

// Helper: try local asset first, then fall back to CDN URL
function tryLoadTexture(localPath, cdnUrl, onLoad) {
    loader.load(
        localPath,
        (t) => { onLoad(t); },
        undefined,
        () => {
            // local failed, try CDN
            loader.load(cdnUrl, (t) => { onLoad(t); }, undefined, () => {
                console.warn(`Failed to load texture from both local (${localPath}) and CDN (${cdnUrl})`);
            });
        }
    );
}

// Helper: set sRGB/colorSpace on textures robustly across three.js versions
function setTextureSRGB(tex) {
    if (!tex) return;
    // Prefer new colorSpace API
    if ('colorSpace' in tex) {
        const cs = (THREE.SRGBColorSpace !== undefined) ? THREE.SRGBColorSpace : (THREE.sRGBEncoding !== undefined ? THREE.sRGBEncoding : undefined);
        if (cs !== undefined) tex.colorSpace = cs;
    } else if ('encoding' in tex && THREE.sRGBEncoding !== undefined) {
        tex.encoding = THREE.sRGBEncoding;
    }
}

// Try loading a grass texture for the ground (local first)
tryLoadTexture('assets/textures/grasslight-big.jpg', 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg', (t) => {
    groundTex = t;
    groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
    groundTex.repeat.set(40, 40);
    // ensure correct color encoding for PBR materials
    setTextureSRGB(groundTex);
    // improve filtering
    try { groundTex.anisotropy = renderer.capabilities.getMaxAnisotropy(); } catch (e) {}
    // apply to ground material if already created
    if (ground && ground.material) {
        ground.material.map = groundTex;
        ground.material.needsUpdate = true;
    }
});

// NOTE: removed legacy UV-grid trunk loader to avoid accidental 404s and visible numbered test textures.
// PBR bark/color maps are loaded later from `assets/textures/pbr/` and will be applied to trunks when ready.
// Try a simple leaf/particle sprite (local first, then fallback to a sprite that exists)
tryLoadTexture('assets/textures/ball.png', 'https://threejs.org/examples/textures/sprites/ball.png', (t) => {
    leavesTex = t;
    setTextureSRGB(leavesTex);
    // apply to any existing leaf meshes
    for (const m of leafMeshes) {
        if (m.material) {
            m.material.map = leavesTex;
            m.material.transparent = true;
            m.material.needsUpdate = true;
        }
    }
});

// If external leaf texture isn't available, use procedural leaf texture
if (!leavesTex) {
    leavesTex = proceduralLeafTex;
}

// Try load PBR placeholders (local pbr folder); fall back to existing textures where sensible
tryLoadTexture('assets/textures/pbr/bark_color.jpg', 'assets/textures/ball.png', (t) => {
    barkColor = t;
    setTextureSRGB(barkColor);
    try { barkColor.anisotropy = renderer.capabilities.getMaxAnisotropy(); } catch (e) {}
    // Avoid applying UV-grid placeholder textures (they contain numeric labels)
    const src = t.image && (t.image.currentSrc || t.image.src) ? (t.image.currentSrc || t.image.src) : '';
    if (/uv[_-]?grid|grid/i.test(src)) {
        console.warn('PBR bark_color is a UV grid placeholder; skipping map to avoid numbers showing on trunks.');
        barkColor = null;
        return;
    }
    for (const m of trunkMeshes) {
        if (m.material) {
            m.material.map = barkColor;
            m.material.needsUpdate = true;
        }
    }
});
tryLoadTexture('assets/textures/pbr/bark_normal.jpg', 'assets/textures/ball.png', (t) => {
    barkNormal = t;
    for (const m of trunkMeshes) {
        if (m.material) {
            m.material.normalMap = barkNormal;
            m.material.needsUpdate = true;
        }
    }
});
tryLoadTexture('assets/textures/pbr/bark_roughness.jpg', 'assets/textures/ball.png', (t) => {
    barkRoughness = t;
    for (const m of trunkMeshes) {
        if (m.material) {
            m.material.roughnessMap = barkRoughness;
            m.material.roughness = 1.0;
            m.material.needsUpdate = true;
        }
    }
});

tryLoadTexture('assets/textures/pbr/leaf_albedo.png', 'assets/textures/ball.png', (t) => {
    leafAlbedo = t;
    setTextureSRGB(leafAlbedo);
    for (const m of leafMeshes) {
        if (m.material) {
            m.material.map = leafAlbedo;
            m.material.transparent = true;
            m.material.alphaTest = 0.45;
            m.material.depthWrite = false;
            m.material.needsUpdate = true;
        }
    }
});
tryLoadTexture('assets/textures/pbr/leaf_alpha.png', 'assets/textures/ball.png', (t) => {
    leafAlpha = t;
    for (const m of leafMeshes) {
        if (m.material) {
            m.material.alphaMap = leafAlpha;
            m.material.transparent = true;
            m.material.alphaTest = 0.45;
            m.material.depthWrite = false;
            m.material.needsUpdate = true;
        }
    }
});
tryLoadTexture('assets/textures/pbr/leaf_normal.jpg', 'assets/textures/ball.png', (t) => {
    leafNormal = t;
    for (const m of leafMeshes) {
        if (m.material) {
            m.material.normalMap = leafNormal;
            m.material.needsUpdate = true;
        }
    }
});

tryLoadTexture('assets/textures/pbr/rock_color.jpg', 'assets/textures/grasslight-big.jpg', (t) => {
    rockColor = t;
    setTextureSRGB(rockColor);
    for (const r of rockMeshes) {
        if (r.material) {
            r.material.map = rockColor;
            r.material.needsUpdate = true;
        }
    }
});
tryLoadTexture('assets/textures/pbr/rock_normal.jpg', 'assets/textures/ball.png', (t) => {
    rockNormal = t;
    for (const r of rockMeshes) {
        if (r.material) {
            r.material.normalMap = rockNormal;
            r.material.needsUpdate = true;
        }
    }
});
tryLoadTexture('assets/textures/pbr/rock_roughness.jpg', 'assets/textures/ball.png', (t) => {
    rockRoughness = t;
    for (const r of rockMeshes) {
        if (r.material) {
            r.material.roughnessMap = rockRoughness;
            r.material.roughness = 1.0;
            r.material.needsUpdate = true;
        }
    }
});

const groundGeometry = new THREE.PlaneGeometry(200, 200);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x2b7a2b, map: groundTex }); // Forest green fallback
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Add sky / clouds: a few large billboards high above that slowly drift
const cloudGroup = new THREE.Group();
const cloudMat = new THREE.MeshBasicMaterial({ map: proceduralCloudTex, transparent: true, depthWrite: false, opacity: 0.95 });
for (let i = 0; i < 12; i++) {
    const size = 60 + Math.random() * 120;
    const geo = new THREE.PlaneGeometry(size, size * 0.6);
    const m = new THREE.Mesh(geo, cloudMat.clone());
    m.position.set((Math.random() - 0.5) * 300, 60 + Math.random() * 40, (Math.random() - 0.5) * 300);
    m.rotation.y = Math.random() * Math.PI;
    m.renderOrder = 0;
    m.material.opacity = 0.75 + Math.random() * 0.25;
    m.castShadow = false; // clouds should not cast dynamic shadows
    cloudGroup.add(m);
}
scene.add(cloudGroup);

// Trees
function createTree(x, z) {
    // Trunk as a small stack of slightly-rotated cylinder segments to simulate a curved trunk
    const trunkMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B4513,
        map: barkColor || barkTex || null,
        normalMap: barkNormal || null,
        roughnessMap: barkRoughness || null,
        roughness: barkRoughness ? 1.0 : 1.0
    });
    const trunkGroup = new THREE.Group();
    const segmentCount = 6;
    const totalHeight = 10;
    const segH = totalHeight / segmentCount;
    for (let s = 0; s < segmentCount; s++) {
        const topR = 1.0 - s * 0.06;
        const botR = 1.0 - (s + 1) * 0.06;
        const segGeo = new THREE.CylinderGeometry(topR, botR, segH, 10);
        const seg = new THREE.Mesh(segGeo, trunkMaterial);
        seg.castShadow = true;
        // position segment relative to group
        seg.position.y = segH * 0.5 + s * segH;
        // slight random bend/rotation per segment
        seg.rotation.z = (Math.random() - 0.5) * 0.18 * (s / segmentCount + 0.4);
        seg.rotation.x = (Math.random() - 0.5) * 0.12 * (s / segmentCount + 0.2);
        trunkGroup.add(seg);
    }
    trunkGroup.position.set(x, 0, z);
    scene.add(trunkGroup);
    trunkMeshes.push(trunkGroup);

    // Add branching stubs (make branches more visible and use them as leaf attachment points)
    const branchCount = 3 + Math.floor(Math.random() * 3); // 3-5 branches for fuller canopy

    // Prepare leaf materials and geometry for instancing
    const smallLeafGeo = new THREE.PlaneGeometry(0.45, 0.7);
    const leafMaterialBase = () => new THREE.MeshStandardMaterial({
        color: 0x1e7a1e,
        map: leafAlbedo || leavesTex || null,
        alphaMap: leafAlpha || null,
        normalMap: leafNormal || null,
        transparent: !!(leafAlbedo || leavesTex),
        side: THREE.DoubleSide,
        alphaTest: 0.15,
        depthWrite: !(leafAlbedo || leavesTex),
        roughness: 0.9
    });
    const leafMaterialVariants = [];
    for (let v = 0; v < 3; v++) {
        const mat = leafMaterialBase();
        mat.transparent = true;
        mat.alphaTest = 0.12;
        mat.depthWrite = false;
        const base = new THREE.Color(0x1e7a1e);
        base.offsetHSL(0, 0, (Math.random() - 0.5) * 0.06);
        mat.color = base;
        leafMaterialVariants.push(mat);
    }

    // Container for canopy instanced mesh(es)
    const canopyGroup = new THREE.Group();

    // Create more prominent branches and attach small instanced leaf clusters to their tips
    for (let b = 0; b < branchCount; b++) {
        const segIndex = 1 + Math.floor(Math.random() * (segmentCount - 2));
    const branchLen = 4.0 + Math.random() * 4.0; // longer branches
    const branchThickness = 0.25 + Math.random() * 0.35; // thicker branches
    const branchGeo = new THREE.CylinderGeometry(branchThickness * 0.6, branchThickness, branchLen, 10);
        const branch = new THREE.Mesh(branchGeo, trunkMaterial);
        branch.castShadow = true;
        // place the base near the chosen segment height
        branch.position.y = segIndex * segH + branchLen * 0.2;
        // offset out to the side
        const angle = Math.random() * Math.PI * 2;
        branch.position.x = Math.cos(angle) * (1.0 + Math.random() * 0.8);
        branch.position.z = Math.sin(angle) * (1.0 + Math.random() * 0.8);
        // rotate to point outward and slightly upward
        branch.rotation.z = -0.6 + (Math.random() * 1.2);
        branch.rotation.y = angle + (Math.random() - 0.5) * 0.4;
        trunkGroup.add(branch);

        // Create an instanced leaf cluster at the branch tip; attach to the branch so positions are local
    const clusterCount = 36 + Math.floor(Math.random() * 36); // larger clusters at tips
        const mat = leafMaterialVariants[Math.floor(Math.random() * leafMaterialVariants.length)];
    const inst = new THREE.InstancedMesh(smallLeafGeo, mat, clusterCount);
    inst.castShadow = false; // avoid many dynamic leaf shadows
    inst.receiveShadow = false;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < clusterCount; i++) {
            // small random offset local to branch (so leaves hug the branch)
            const rx = (Math.random() - 0.5) * 0.9;
            const ry = (Math.random() * 0.9) + branchLen * 0.35; // biased toward tip
            const rz = (Math.random() - 0.5) * 0.9;
            dummy.position.set(rx, ry, rz);
            dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            const scale = 0.28 + Math.random() * 0.8;
            dummy.scale.set(scale, scale, scale);
            dummy.updateMatrix();
            inst.setMatrixAt(i, dummy.matrix);
            if (inst.setColorAt) inst.setColorAt(i, mat.color);
        }
        inst.instanceMatrix.needsUpdate = true;
        if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
        // Add the instanced cluster as a child of the branch so it's positioned at branch local origin
        branch.add(inst);
        leafMeshes.push(inst);

        // Also add along-branch leaf clusters to fill the branch shaft (a few small instanced leaves along the branch)
    const alongCount = 12 + Math.floor(Math.random() * 8); // more along-branch leaves
    const instAlong = new THREE.InstancedMesh(smallLeafGeo, mat, alongCount);
    instAlong.castShadow = false;
    instAlong.receiveShadow = false;
        const tmp = new THREE.Object3D();
        for (let k = 0; k < alongCount; k++) {
            const t = k / (alongCount - 1);
            const lx = (Math.random() - 0.5) * 0.6;
            const ly = branchLen * (0.1 + t * 0.8);
            const lz = (Math.random() - 0.5) * 0.6;
            tmp.position.set(lx, ly, lz);
            tmp.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            const s = 0.22 + Math.random() * 0.6;
            tmp.scale.set(s, s, s);
            tmp.updateMatrix();
            instAlong.setMatrixAt(k, tmp.matrix);
            if (instAlong.setColorAt) instAlong.setColorAt(k, mat.color);
        }
        instAlong.instanceMatrix.needsUpdate = true;
        if (instAlong.instanceColor) instAlong.instanceColor.needsUpdate = true;
        branch.add(instAlong);
        leafMeshes.push(instAlong);
    }

    // Create a larger canopy as an instanced mesh attached to the trunkGroup
    const leavesPerTree = 160 + Math.floor(Math.random() * 120); // denser canopy
    const canopyMat = leafMaterialVariants[Math.floor(Math.random() * leafMaterialVariants.length)];
    const canopyInst = new THREE.InstancedMesh(smallLeafGeo, canopyMat, leavesPerTree);
    canopyInst.castShadow = false;
    canopyInst.receiveShadow = false;
    const temp = new THREE.Object3D();
    for (let i = 0; i < leavesPerTree; i++) {
        const radius = 0.6 + Math.random() * 2.6;
        const angle = Math.random() * Math.PI * 2;
        const height = 6 + Math.random() * 6;
        temp.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
        temp.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        const scale = 0.25 + Math.random() * 1.0;
        temp.scale.set(scale, scale, scale);
        temp.updateMatrix();
        canopyInst.setMatrixAt(i, temp.matrix);
        if (canopyInst.setColorAt) canopyInst.setColorAt(i, canopyMat.color);
    }
    canopyInst.instanceMatrix.needsUpdate = true;
    if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
    canopyGroup.add(canopyInst);

    trunkGroup.add(canopyGroup);

    // Add a few soft trunk-top clusters to fill the crown base
    for (let tc = 0; tc < 3; tc++) {
        const topClusterGeo = new THREE.SphereGeometry(1.2 + Math.random() * 1.6, 10, 8);
        const topMat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x1f7b1f).offsetHSL(0, 0, (Math.random() - 0.5) * 0.06),
            roughness: 0.95,
            transparent: true,
            opacity: 0.98
        });
        const top = new THREE.Mesh(topClusterGeo, topMat);
        top.position.set((Math.random() - 0.5) * 1.2, totalHeight - 2 + Math.random() * 2.5, (Math.random() - 0.5) * 1.2);
        top.castShadow = true;
        trunkGroup.add(top);
        leafMeshes.push(top);
    }

    // Add vines
    for (let i = 0; i < 3; i++) {
        const vineGeometry = new THREE.CylinderGeometry(0.1, 0.1, 8, 8);
        const vineMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const vine = new THREE.Mesh(vineGeometry, vineMaterial);
        vine.position.set(x + (Math.random() - 0.5) * 2, 10, z + (Math.random() - 0.5) * 2);
        vine.rotation.z = Math.random() * Math.PI;
        vine.castShadow = true;
        scene.add(vine);
    }
}

// Create a pine/conifer style tree with stacked cones so it reads like a fir/spruce
function createPineTree(x, z, height = 12, scale = 1.0) {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4b36, roughness: 1.0 });
    const trunkGeo = new THREE.CylinderGeometry(0.6 * scale, 0.9 * scale, height * 0.18, 8);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = (height * 0.18) / 2;
    trunk.castShadow = true;
    group.add(trunk);

    // stacked conical foliage layers
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1f6f2f, roughness: 0.9 });
    const layers = Math.max(3, Math.floor(height / 3));
    for (let i = 0; i < layers; i++) {
        const topRadius = Math.max(0.5, (layers - i) * 0.6) * scale;
        const heightLayer = Math.max(1.2, height * 0.12) * scale;
        const coneGeo = new THREE.ConeGeometry(topRadius, heightLayer, 10);
        const cone = new THREE.Mesh(coneGeo, foliageMat);
        cone.position.y = trunk.position.y + (i * (heightLayer * 0.6)) + 0.5;
        cone.castShadow = true;
        cone.receiveShadow = true;
        // slight random rotation for natural look
        cone.rotation.y = (Math.random() - 0.5) * 0.6;
        group.add(cone);
    }

    group.position.set(x, 0, z);
    scene.add(group);
    // remember for potential PBR updates
    trunkMeshes.push(group);
}

// Mountains: create simple large cones using rock PBR maps if available
function createMountains() {
    const mountainGroup = new THREE.Group();
    const mcount = 5;
    for (let i = 0; i < mcount; i++) {
        const mx = (Math.random() - 0.5) * 400;
        const mz = -120 - Math.random() * 80 - i * 40;
        const mHeight = 60 + Math.random() * 120;
        const rad = mHeight * (0.7 + Math.random() * 0.6);
        const geo = new THREE.ConeGeometry(rad, mHeight, 24);
        // perturb vertices slightly for ruggedness
        const pos = geo.attributes.position;
        for (let v = 0; v < pos.count; v++) {
            const ox = pos.getX(v);
            const oy = pos.getY(v);
            const oz = pos.getZ(v);
            const n = (Math.random() - 0.5) * (mHeight * 0.02);
            pos.setXYZ(v, ox + n, oy + n * 0.2, oz + n);
        }
        geo.computeVertexNormals();

        const matOpts = { color: 0x7b7b7b, roughness: 0.95 };
        if (rockColor) {
            matOpts.map = rockColor;
            setTextureSRGB(rockColor);
        }
        if (rockNormal) matOpts.normalMap = rockNormal;
        if (rockRoughness) matOpts.roughnessMap = rockRoughness;
        const mat = new THREE.MeshStandardMaterial(matOpts);
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(mx, mHeight / 2 - 6, mz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mountainGroup.add(mesh);
    }
    scene.add(mountainGroup);
}

// Water / river: create a long plane and apply a simple shader that animates waves
let waterUniforms = null;
function createRiver() {
    // create a long plane and rotate to snake through the scene roughly along Z
    const w = 240; const l = 60;
    const planeGeo = new THREE.PlaneGeometry(w, l, 128, 32);
    waterUniforms = {
        time: { value: 0 },
        colorA: { value: new THREE.Color(0x1e9cff) },
        colorB: { value: new THREE.Color(0x063b78) },
        sunDir: { value: new THREE.Vector3(0.5, 0.8, 0.2).normalize() },
        cameraPos: { value: new THREE.Vector3() }
    };
    const waterMat = new THREE.ShaderMaterial({
        uniforms: waterUniforms,
        vertexShader: `
            uniform float time;
            varying vec2 vUv;
            varying float vWave;
            varying vec3 vPos;
            void main() {
                vUv = uv;
                vec3 pos = position;
                float wave1 = sin((pos.x + time * 6.0) * 0.06) * 0.6;
                float wave2 = sin((pos.y + time * 4.0) * 0.08) * 0.4;
                float wave = wave1 + wave2;
                pos.z += wave * 0.8;
                vWave = wave;
                vPos = (modelMatrix * vec4(pos, 1.0)).xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 colorA;
            uniform vec3 colorB;
            uniform vec3 sunDir;
            uniform vec3 cameraPos;
            varying vec2 vUv;
            varying float vWave;
            varying vec3 vPos;
            void main() {
                float t = smoothstep(0.0, 1.0, vUv.y);
                vec3 base = mix(colorB, colorA, t + vWave * 0.05);
                // approximate normal from wave (small finite diff)
                float dx = 0.06 * cos((vPos.x + 0.0) * 0.06) * 0.6 + 0.08 * cos((vPos.y + 0.0) * 0.08) * 0.4;
                vec3 n = normalize(vec3(-dx, 1.0, -dx));
                vec3 L = normalize(sunDir);
                vec3 V = normalize(cameraPos - vPos);
                vec3 R = reflect(-L, n);
                float diff = max(dot(n, L), 0.0);
                float spec = pow(max(dot(R, V), 0.0), 40.0);
                vec3 col = base * (0.55 + diff * 0.6) + vec3(spec * 1.6);
                float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0) * 0.25;
                col += fres * vec3(1.0, 1.0, 1.0) * 0.12;
                gl_FragColor = vec4(col, 0.95);
            }
        `,
        transparent: true
    });
    const water = new THREE.Mesh(planeGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.4, 0);
    water.receiveShadow = false;
    water.castShadow = false;
    scene.add(water);

    // slightly tilt and curve by rotating groups (simple approximation of a meandering river)
    const bend = new THREE.Group();
    bend.add(water);
    bend.rotation.y = 0.12;
    bend.position.z = 10;
    scene.add(bend);
}

// Obstacles array for collision
const obstacles = [];

// Add multiple trees
for (let i = 0; i < 20; i++) {
    const x = (Math.random() - 0.5) * 100;
    const z = (Math.random() - 0.5) * 100;
    // avoid river area (we'll define a simple river bounding box)
    if (Math.abs(z - 0) < 35 && Math.abs(x - 0) < 110) {
        // skip placing trees in main river corridor
        continue;
    }
    createTree(x, z);
    obstacles.push({ x, z, radius: 5 }); // Approximate radius
}

// Houses array (positions/size) to avoid tree placement and allow entrance
const houses = [];
function createHouse(x, z, w = 6, d = 6, h = 4) {
    const houseGroup = new THREE.Group();
    // floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), new THREE.MeshStandardMaterial({ color: 0x8b6b4a }));
    floor.position.set(0, 0.1, 0);
    floor.receiveShadow = true;
    houseGroup.add(floor);
    // four walls but leave a doorway in front
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xefe4d1 });
    const halfW = w / 2, halfD = d / 2;
    // back wall
    const back = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), wallMat);
    back.position.set(0, h / 2, -halfD + 0.1);
    back.receiveShadow = true; back.castShadow = true; houseGroup.add(back);
    // left wall
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.2, h, d), wallMat);
    left.position.set(-halfW + 0.1, h / 2, 0);
    left.receiveShadow = true; left.castShadow = true; houseGroup.add(left);
    // right wall
    const right = new THREE.Mesh(new THREE.BoxGeometry(0.2, h, d), wallMat);
    right.position.set(halfW - 0.1, h / 2, 0);
    right.receiveShadow = true; right.castShadow = true; houseGroup.add(right);
    // front wall sections with door gap
    const doorW = 1.2;
    const frontLeft = new THREE.Mesh(new THREE.BoxGeometry((w - doorW) / 2, h, 0.2), wallMat);
    frontLeft.position.set(- (w + doorW) / 4, h / 2, halfD - 0.1);
    frontLeft.receiveShadow = true; frontLeft.castShadow = true; houseGroup.add(frontLeft);
    const frontRight = new THREE.Mesh(new THREE.BoxGeometry((w - doorW) / 2, h, 0.2), wallMat);
    frontRight.position.set((w + doorW) / 4, h / 2, halfD - 0.1);
    frontRight.receiveShadow = true; frontRight.castShadow = true; houseGroup.add(frontRight);
    // roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, h * 0.8, 4), new THREE.MeshStandardMaterial({ color: 0x7a3b2a }));
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, h + 0.6, 0);
    roof.castShadow = true; roof.receiveShadow = false; houseGroup.add(roof);

    houseGroup.position.set(x, 0, z);
    scene.add(houseGroup);
    houses.push({ x, z, w, d });
}

// Create 4 houses spaced on map (away from river)
createHouse(-30, 30, 7, 6, 4);
createHouse(35, 25, 6, 8, 4);
createHouse(-20, -40, 8, 7, 4.5);
createHouse(40, -35, 6, 6, 4);

// Remove any previously-placed trees that overlap house footprints (we placed trees earlier)
for (const h of houses) {
    for (let i = trunkMeshes.length - 1; i >= 0; i--) {
        const t = trunkMeshes[i];
        const tx = t.position.x, tz = t.position.z;
        const dist = Math.hypot(tx - h.x, tz - h.z);
        if (dist < Math.max(h.w, h.d) * 1.2) {
            if (t.parent) t.parent.remove(t);
            scene.remove(t);
            trunkMeshes.splice(i, 1);
        }
    }
    // prune obstacles near houses too
    for (let j = obstacles.length - 1; j >= 0; j--) {
        const ox = obstacles[j].x, oz = obstacles[j].z;
        if (Math.hypot(ox - h.x, oz - h.z) < Math.max(h.w, h.d) * 1.2) obstacles.splice(j, 1);
    }
}

// Add mountain backdrop and river, then populate some pine trees near the river
createMountains();
createRiver();
// Plant pine trees along river banks (avoid placing them directly in the river corridor)
for (let i = 0; i < 24; i++) {
    const side = (i % 2 === 0) ? -1 : 1; // alternate banks
    const x = side * (20 + Math.random() * 30);
    const z = -10 + (Math.random() * 8) + (side * (5 + Math.random() * 6));
    createPineTree(x, z, 10 + Math.random() * 8, 0.9 + Math.random() * 0.8);
    obstacles.push({ x, z, radius: 3 });
}

// Rocks
function createRock(x, z) {
    // Create a low-poly rock with vertex perturbation for a more natural shape
    const rockGeometry = new THREE.IcosahedronGeometry(2, 1);
    // perturb vertices
    const pos = rockGeometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const n = 0.35 * (Math.random() - 0.5);
        pos.setXYZ(i, vx + n, vy + n, vz + n);
    }
    rockGeometry.computeVertexNormals();

    const rockMaterial = new THREE.MeshStandardMaterial({
        color: 0x777777,
        map: rockColor || null,
        normalMap: rockNormal || null,
        roughnessMap: rockRoughness || null,
        roughness: rockRoughness ? 1.0 : 0.9
    });
    const rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.position.set(x, 1, z);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
    rockMeshes.push(rock);
}

for (let i = 0; i < 10; i++) {
    const x = (Math.random() - 0.5) * 100;
    const z = (Math.random() - 0.5) * 100;
    createRock(x, z);
    obstacles.push({ x, z, radius: 2 });
}

// Bushes
function createBush(x, z) {
    // Build a bush from overlapping small spheres/leaf-clusters for more natural silhouette
    const bushGroup = new THREE.Group();
    const pieces = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < pieces; i++) {
        const size = 1.4 + Math.random() * 1.8;
        const geo = new THREE.SphereGeometry(size, 10, 8);
        const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0x228B22).offsetHSL(0, 0, (Math.random() - 0.5) * 0.07),
            roughness: 0.9,
            metalness: 0.0
        });
        const m = new THREE.Mesh(geo, mat);
        m.position.set((Math.random() - 0.5) * 1.6 + x, size * 0.5 + Math.random() * 0.6, (Math.random() - 0.5) * 1.6 + z);
        m.castShadow = true;
        m.receiveShadow = true;
        bushGroup.add(m);
    }
    bushGroup.position.set(0, 0, 0);
    scene.add(bushGroup);
}

// Collectibles (fruits)
let score = 0;
const collectibles = [];
const scoreElement = document.getElementById('score');

function createFruit(x, z) {
    const fruitGeometry = new THREE.SphereGeometry(0.5, 8, 8);
    const fruitMaterial = new THREE.MeshLambertMaterial({ color: 0xFF4500 });
    const fruit = new THREE.Mesh(fruitGeometry, fruitMaterial);
    fruit.position.set(x, 2, z);
    fruit.castShadow = true;
    scene.add(fruit);
    collectibles.push(fruit);
}

for (let i = 0; i < 15; i++) {
    const x = (Math.random() - 0.5) * 100;
    const z = (Math.random() - 0.5) * 100;
    createBush(x, z);
    obstacles.push({ x, z, radius: 3 });
}

// Add fruits
for (let i = 0; i < 10; i++) {
    const x = (Math.random() - 0.5) * 100;
    const z = (Math.random() - 0.5) * 100;
    createFruit(x, z);
}

// Player controls
// Movement state for pointer-lock controls
const moveState = { forward: false, backward: false, left: false, right: false };
document.addEventListener('keydown', (e) => {
    switch (e.code) {
        case 'KeyW': moveState.forward = true; break;
        case 'KeyS': moveState.backward = true; break;
        case 'KeyA': moveState.left = true; break;
        case 'KeyD': moveState.right = true; break;
    }
});
document.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'KeyW': moveState.forward = false; break;
        case 'KeyS': moveState.backward = false; break;
        case 'KeyA': moveState.left = false; break;
        case 'KeyD': moveState.right = false; break;
    }
});

const moveSpeed = 6.0; // units per second (we'll multiply by delta)
const velocity = new THREE.Vector3();

// Collision detection
function checkCollision(newX, newZ) {
    for (let obs of obstacles) {
        const distance = Math.sqrt((newX - obs.x) ** 2 + (newZ - obs.z) ** 2);
        if (distance < obs.radius + 0.6) { // Player radius approx 0.5
            return true;
        }
    }
    return false;
}

// Audio will be created on user gesture (when game starts) to satisfy browser autoplay policies
let audioContext = null;
function initAudio() {
    if (audioContext) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

function createBeep(frequency, duration, volume = 0.1) {
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

function playCollectSound() { createBeep(900, 0.12, 0.12); }
function playAmbientSound() { createBeep(220 + Math.random() * 80, 0.4, 0.05); }

// Animation loop
let lastTime = performance.now();
function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const delta = (now - lastTime) / 1000; // seconds
    lastTime = now;

    // Movement: build direction from camera forward/right on XZ plane
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();
    const right = new THREE.Vector3();
    right.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();

    // desired velocity change
    const moveVector = new THREE.Vector3();
    if (moveState.forward) moveVector.add(direction);
    if (moveState.backward) moveVector.sub(direction);
    if (moveState.left) moveVector.sub(right);
    if (moveState.right) moveVector.add(right);

    if (moveVector.lengthSq() > 0) moveVector.normalize();

    // interpolate velocity for smooth acceleration
    const targetVel = moveVector.multiplyScalar(moveSpeed);
    velocity.lerp(targetVel, Math.min(1, 10 * delta));

    // propose new position
    const newX = camera.position.x + velocity.x * delta;
    const newZ = camera.position.z + velocity.z * delta;
    if (!checkCollision(newX, newZ)) {
        camera.position.x = newX;
        camera.position.z = newZ;
    } else {
        // simple sliding: try X-only then Z-only
        if (!checkCollision(camera.position.x + velocity.x * delta, camera.position.z)) {
            camera.position.x += velocity.x * delta;
        } else if (!checkCollision(camera.position.x, camera.position.z + velocity.z * delta)) {
            camera.position.z += velocity.z * delta;
        } else {
            velocity.set(0, 0, 0);
        }
    }

    // Sync visible player mesh to camera position (offset down so camera is at head)
    player.position.set(camera.position.x, 1, camera.position.z);
    player.rotation.y = camera.rotation.y;

    // Check for collectibles
    for (let i = collectibles.length - 1; i >= 0; i--) {
        const fruit = collectibles[i];
        const distance = Math.hypot(camera.position.x - fruit.position.x, camera.position.z - fruit.position.z);
        if (distance < 1.2) {
            // small pop animation
            scene.remove(fruit);
            collectibles.splice(i, 1);
            score++;
            scoreElement.textContent = score;
            playCollectSound();
        }
    }

    // Animate clouds slowly
    cloudGroup.children.forEach((c, idx) => {
        // drift and slow bobbing
        c.position.x += Math.sin(now * 0.00012 + idx) * 0.02;
        c.position.z += Math.cos(now * 0.00009 + idx) * 0.02;
        c.position.y += Math.sin(now * 0.0002 + idx) * 0.002; // subtle vertical bob
        c.rotation.y += 0.00005 * (idx % 3 - 1); // slow rotation variation
    });

    // Optional: update sun visual (if present)
    if (sunMesh) {
        sunMesh.position.copy(directionalLight.position);
    }

    // update water animation uniform and camera/sun uniforms
    if (waterUniforms && typeof waterUniforms.time !== 'undefined') {
        waterUniforms.time.value = now * 0.001;
        if (waterUniforms.sunDir) waterUniforms.sunDir.value.copy(directionalLight.position).normalize();
        if (waterUniforms.cameraPos) waterUniforms.cameraPos.value.copy(camera.position);
    }

    renderer.render(scene, camera);
}

animate();

// Quick automatic visual tuning pass to improve leaf visibility and overall PBR look.
function autoTuneVisuals() {
    console.log('Auto-tuning visuals: exposure, light intensity, leaf alpha/visibility, roughness.');
    try {
        // Gentle exposure increase to make albedos pop (safe default)
        if ('toneMappingExposure' in renderer) renderer.toneMappingExposure = 1.05;
        // Increase directional light slightly for clearer shading on bark and leaves
        if (directionalLight) directionalLight.intensity = 1.25;
        // Slight hemisphere boost for fill
        if (hemiLight) hemiLight.intensity = 0.6;

        // Apply leaf visibility improvements
        for (const lm of leafMeshes) {
            if (!lm || !lm.material) continue;
            // ensure materials render transparently and are not culled by alphaTest
            lm.material.transparent = true;
            // lower alphaTest so semi-transparent leaf pixels remain visible
            if (typeof lm.material.alphaTest !== 'undefined') lm.material.alphaTest = 0.18;
            // ensure depthWrite off for transparent planes to avoid z-fighting
            lm.material.depthWrite = false;
            // prefer fully opaque opacity if alphaMap absent
            if (!lm.material.alphaMap) lm.material.opacity = 1.0;
            // reapply sRGB for albedo textures if present
            if (lm.material.map) setTextureSRGB(lm.material.map);
            lm.material.needsUpdate = true;
        }

        // Improve trunk and rock roughness/metalness defaults for PBR look
        const applyToMesh = (obj, cb) => {
            if (!obj) return;
            if (obj.isMesh && obj.material) cb(obj);
            if (obj.children && obj.children.length) {
                obj.children.forEach(c => { if (c.isMesh && c.material) cb(c); });
            }
        };

        for (const t of trunkMeshes) {
            applyToMesh(t, (m) => {
                if (m.material) {
                    m.material.roughness = (typeof m.material.roughness === 'number') ? m.material.roughness : 1.0;
                    m.material.metalness = 0.0;
                    if (m.material.map) setTextureSRGB(m.material.map);
                    m.material.needsUpdate = true;
                }
            });
        }

        for (const r of rockMeshes) {
            applyToMesh(r, (m) => {
                if (m.material) {
                    m.material.roughness = 0.85;
                    m.material.metalness = 0.0;
                    if (m.material.map) setTextureSRGB(m.material.map);
                    m.material.needsUpdate = true;
                }
            });
        }

        // Ground tuning
        if (ground && ground.material) {
            ground.material.roughness = 1.0;
            ground.material.metalness = 0.0;
            if (ground.material.map) setTextureSRGB(ground.material.map);
            ground.material.needsUpdate = true;
        }
    } catch (e) {
        console.warn('autoTuneVisuals failed:', e);
    }
}

// Run an initial automatic tuning pass
autoTuneVisuals();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});