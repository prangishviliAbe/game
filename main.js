import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from './scripts/Sky.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();
// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue background
scene.fog = new THREE.Fog(0x87CEEB, 100, 800); // Add fog for depth, increased near and far distances

// Procedural sky
const skyObj = new Sky();
skyObj.scale.setScalar(10000);
scene.add(skyObj);


const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
// Try to create WebGL renderer with fallback options
let renderer;
try {
    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('game-canvas'),
        antialias: false, // Disable antialiasing to reduce resource usage
        powerPreference: "default", // Use default power preference
        failIfMajorPerformanceCaveat: false,
        stencil: false, // Disable stencil buffer
        depth: true // Keep depth buffer
    });

    // Test if renderer was created successfully
    if (renderer && renderer.domElement) {
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = false; // Disable shadows to reduce load
        renderer.toneMapping = THREE.NoToneMapping; // Disable tone mapping
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.physicallyCorrectLights = false; // Disable physically correct lights
        console.log('WebGL renderer created successfully');
    } else {
        throw new Error('Renderer creation failed');
    }
} catch (error) {
    console.error('WebGL Renderer creation failed, trying minimal fallback:', error);

    // Create minimal fallback renderer
    try {
        renderer = new THREE.WebGLRenderer({
            canvas: document.getElementById('game-canvas')
        });
        renderer.setSize(window.innerWidth, window.innerHeight);
        console.log('Minimal WebGL renderer created as fallback');
    } catch (fallbackError) {
        console.error('Even minimal WebGL renderer failed:', fallbackError);
        // Show error message to user
        const canvas = document.getElementById('game-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = 'red';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'white';
                ctx.font = '20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('WebGL not supported', canvas.width / 2, canvas.height / 2);
                ctx.fillText('Please update your browser or graphics drivers', canvas.width / 2, canvas.height / 2 + 30);
            }
        }
        throw fallbackError; // Re-throw to stop execution
    }
}

// Enhanced lighting system for realistic rendering
const ambientLight = new THREE.AmbientLight(0x404040, 0.4); // Reduced ambient for more contrast
scene.add(ambientLight);

// Primary sun light with realistic properties
const directionalLight = new THREE.DirectionalLight(0xfff1c1, 1.2);
directionalLight.position.set(80, 120, 50);
directionalLight.castShadow = true;
// High-quality shadow mapping
directionalLight.shadow.mapSize.width = 8192;
directionalLight.shadow.mapSize.height = 8192;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 500;
directionalLight.shadow.camera.left = -150;
directionalLight.shadow.camera.right = 150;
directionalLight.shadow.camera.top = 150;
directionalLight.shadow.camera.bottom = -150;
directionalLight.shadow.bias = -0.0001;
directionalLight.shadow.normalBias = 0.02;
// Soft shadows
if ('radius' in directionalLight.shadow) directionalLight.shadow.radius = 8;
scene.add(directionalLight);

// Fill light from the opposite side for more natural illumination
const fillLight = new THREE.DirectionalLight(0x87CEEB, 0.3);
fillLight.position.set(-50, 80, -30);
fillLight.castShadow = false; // No shadows from fill light
scene.add(fillLight);

// Hemisphere light for sky/ground color bounce
const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x8B7355, 0.6); // Sky blue to warm ground
hemiLight.position.set(0, 100, 0);
scene.add(hemiLight);

// Additional rim lighting for depth
const rimLight = new THREE.DirectionalLight(0xffffff, 0.2);
rimLight.position.set(0, 50, -100);
rimLight.castShadow = false;
scene.add(rimLight);

// Sun removed from game

// Player character - load animated 3D character with VR headset
let playerCharacter = null;
loadGLTFModel('assets/models/downloads/animated_3d_self_character_with_vrheadset.glb', (gltf) => {
    playerCharacter = gltf.scene;
    playerCharacter.scale.set(0.6, 0.6, 0.6); // Even smaller for better proportions

    playerCharacter.traverse(function (object) {
        if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
            // Apply realistic character material properties
            if (object.material) {
                if (object.material.map) {
                    object.material.map.colorSpace = THREE.SRGBColorSpace;
                }
                object.material.roughness = 0.7;
                object.material.metalness = 0.0;
                object.material.needsUpdate = true;
            }
        }
    });

    scene.add(playerCharacter);

    // Try to play animations
    const mixer = new THREE.AnimationMixer(playerCharacter);
    if (gltf.animations && gltf.animations.length > 0) {
        const action = mixer.clipAction(gltf.animations[0]);
        action.play();
        action.timeScale = 1.0;
    }
    mixers.push(mixer);
}, (error) => {
    console.warn('Failed to load character model, using fallback:', error);
    // Fallback to original capsule
    const playerGroup = new THREE.Group();
    const playerGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
    const playerMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const body = new THREE.Mesh(playerGeometry, playerMaterial);
    body.position.set(0, 1, 0);
    body.castShadow = true;
    playerGroup.add(body);
    scene.add(playerGroup);
});

// Camera / controls setup (we use pointer lock for immersive adventure)
camera.position.set(0, 2, 0); // camera height relative to player
const controls = new PointerLockControls(camera, renderer.domElement);
// We won't add the control object to the scene (camera is enough). The player mesh remains visible and will be synced to camera.

// Audio will be created on user gesture (when game starts) to satisfy browser autoplay policies
let audioContext = null;

function initAudio() {
    if (audioContext) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

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
let sandColor = null, sandNormal = null, sandRoughness = null;
let woodColor = null, woodNormal = null, woodRoughness = null;
let skinColor = null, skinNormal = null, skinRoughness = null;
let brickColor = null, brickNormal = null, brickRoughness = null;
let grassColor = null, grassNormal = null, grassRoughness = null;

// Keep references to created meshes so we can apply textures after async load
const trunkMeshes = [];
const leafMeshes = [];
const rockMeshes = [];
const mountainMeshes = [];
const wallMaterials = [];
const animatedHumans = [];
const mixers = [];

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
tryLoadTexture('assets/textures/pbr/grass_color.jpg', 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg', (t) => {
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
    // apply to mountain materials
    for (const m of mountainMeshes) {
        if (m.material) {
            m.material.map = groundTex;
            m.material.needsUpdate = true;
        }
    }
});

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

// Load water texture for enhanced water graphics
let waterColorTex = null;
tryLoadTexture('assets/textures/pbr/grass_color.jpg', 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg', (t) => {
    waterColorTex = t;
    setTextureSRGB(waterColorTex);
    // Do not apply grass texture to water to avoid artifacts
    // if (water && water.material) {
    //     water.material.uniforms['waterTexture'].value = waterColorTex;
    //     water.material.needsUpdate = true;
    // }
});

// Try load PBR placeholders (local pbr folder); fall back to existing textures where sensible
tryLoadTexture('assets/textures/pbr/bark_color.jpg', 'https://threejs.org/examples/textures/brick_diffuse.jpg', (t) => {
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

// Load additional textures for enhanced realism (removed duplicate loading)
tryLoadTexture('assets/textures/pbr/bark_normal.jpg', 'https://threejs.org/examples/textures/brick_diffuse.jpg', (t) => {
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

tryLoadTexture('assets/textures/pbr/leaf_albedo.png', 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg', (t) => {
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
tryLoadTexture('assets/textures/pbr/leaf_normal.jpg', 'https://threejs.org/examples/textures/brick_diffuse.jpg', (t) => {
    leafNormal = t;
    for (const m of leafMeshes) {
        if (m.material) {
            m.material.normalMap = leafNormal;
            m.material.needsUpdate = true;
        }
    }
});

tryLoadTexture('assets/textures/pbr/rock_color.jpg', 'https://ambientcg.com/get?filename=Rock035_1K_Color.jpg', (t) => {
    rockColor = t;
    setTextureSRGB(rockColor);
    // Avoid applying UV-grid placeholder textures (they contain numeric labels)
    const src = t.image && (t.image.currentSrc || t.image.src) ? (t.image.currentSrc || t.image.src) : '';
    if (/uv[_-]?grid|grid/i.test(src)) {
        console.warn('PBR rock_color is a UV grid placeholder; skipping map to avoid numbers showing on mountains.');
        rockColor = null;
        return;
    }
    for (const r of rockMeshes) {
        if (r.material) {
            r.material.map = rockColor;
            r.material.needsUpdate = true;
        }
    }
    // apply to mountain materials
    for (const m of mountainMeshes) {
        if (m.material) {
            m.material.map = rockColor;
            m.material.needsUpdate = true;
        }
    }
});
tryLoadTexture('assets/textures/pbr/rock_normal.jpg', 'https://ambientcg.com/get?filename=Rock035_1K_Normal.jpg', (t) => {
    rockNormal = t;
    for (const r of rockMeshes) {
        if (r.material) {
            r.material.normalMap = rockNormal;
            r.material.needsUpdate = true;
        }
    }
});
tryLoadTexture('assets/textures/pbr/rock_roughness.jpg', 'https://ambientcg.com/get?filename=Rock035_1K_Roughness.jpg', (t) => {
    rockRoughness = t;
    for (const r of rockMeshes) {
        if (r.material) {
            r.material.roughnessMap = rockRoughness;
            r.material.roughness = 1.0;
            r.material.needsUpdate = true;
        }
    }
    // apply to mountains
    for (const m of mountainMeshes) {
        if (m.material && m.material.userData && m.material.userData.type === 'rock') {
            m.material.roughnessMap = rockRoughness;
            m.material.roughness = 1.0;
            m.material.needsUpdate = true;
        }
    }
});




tryLoadTexture('assets/textures/pbr/brick_color.jpg', 'https://threejs.org/examples/textures/brick_diffuse.jpg', (t) => {
    brickColor = t;
    setTextureSRGB(brickColor);
    for (const m of wallMaterials) {
        if (m) {
            m.map = brickColor;
            m.needsUpdate = true;
        }
    }
});
tryLoadTexture('assets/textures/pbr/brick_normal.jpg', 'https://threejs.org/examples/textures/brick_normal.jpg', (t) => {
    brickNormal = t;
    for (const m of wallMaterials) {
        if (m) {
            m.normalMap = brickNormal;
            m.needsUpdate = true;
        }
    }
});
tryLoadTexture('assets/textures/pbr/brick_roughness.jpg', 'assets/textures/ball.png', (t) => {
    brickRoughness = t;
    for (const m of wallMaterials) {
        if (m) {
            m.roughnessMap = brickRoughness;
            m.roughness = 1.0;
            m.needsUpdate = true;
        }
    }
});

tryLoadTexture('assets/textures/pbr/grass_color.jpg', 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg', (t) => {
    grassColor = t;
    setTextureSRGB(grassColor);
    try { grassColor.anisotropy = renderer.capabilities.getMaxAnisotropy(); } catch (e) {}
    // Apply to existing bushes if any
    // Since bushes are created later, handle in createBush
});
tryLoadTexture('assets/textures/pbr/grass_normal.jpg', 'https://threejs.org/examples/textures/brick_diffuse.jpg', (t) => {
    grassNormal = t;
    // Apply to existing bushes if any
});
tryLoadTexture('assets/textures/pbr/grass_roughness.jpg', 'assets/textures/ball.png', (t) => {
    grassRoughness = t;
    // Apply to existing bushes if any
});

const groundGeometry = new THREE.PlaneGeometry(340, 340, 64, 64); // Higher resolution to prevent texture flickering
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x2b7a2b, map: groundTex }); // Forest green fallback
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Pond and clearing removed as requested

// Add banks around the ocean - removed since we now have a 3D ocean model


// Skybox using procedural sky (GLTF skybox removed to avoid conflicts)
scene.background = new THREE.Color(0x87CEEB); // Sky blue background
scene.fog = new THREE.Fog(0x87CEEB, 100, 800); // Add fog for depth


const sun = new THREE.Vector3();
const pmremGenerator = new THREE.PMREMGenerator(renderer);
let renderTarget;
let skyUniforms = null; // Will be set if procedural sky is used

// Sun update function removed

// Sun loading code removed

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
    const smallLeafGeo = new THREE.PlaneGeometry(0.3, 0.5);
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
            const scale = 0.15 + Math.random() * 0.4;
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
            const s = 0.12 + Math.random() * 0.3;
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
        const scale = 0.15 + Math.random() * 0.5;
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

// Create a birch tree with white bark and black stripes
function createBirchTree(x, z, height = 15, scale = 1.0) {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const trunkGeo = new THREE.CylinderGeometry(0.4 * scale, 0.6 * scale, height * 0.9, 8);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = (height * 0.9) / 2;
    trunk.castShadow = true;
    group.add(trunk);

    // Add black stripes on trunk
    const stripeCount = 10;
    for (let i = 0; i < stripeCount; i++) {
        const stripeGeo = new THREE.CylinderGeometry(0.61 * scale, 0.61 * scale, 0.1, 8);
        const stripeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.position.y = (height * 0.9) * (i / stripeCount) - (height * 0.9) / 2 + 0.05;
        group.add(stripe);
    }

    // Add leaves
    const leafGeo = new THREE.SphereGeometry(2 * scale, 10, 8);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.9 });
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.y = height * 0.9 + 1;
    leaves.castShadow = true;
    group.add(leaves);

    group.position.set(x, 0, z);
    scene.add(group);
    trunkMeshes.push(group);
}

// Replace procedural mountains with 3D rock models - only two mountains at beginning and end of map
function createMountains() {
    const mountainPositions = [
        // Beginning of map (front)
        { x: 0, z: 170 },
        // End of map (back)
        { x: 0, z: -180 }
    ];

    mountainPositions.forEach((pos, index) => {
        loadGLTFModel('assets/models/downloads/mountin/rock_by_the_sea.glb', (gltf) => {
            const mountain = gltf.scene;
            const scale = 3.0 + Math.random() * 2.0; // Varying sizes
            mountain.scale.set(scale, scale, scale);

            // Position mountain at ground level by adjusting Y position based on bounding box
            mountain.position.set(pos.x, 0, pos.z);
            let minY = 0;
            mountain.traverse(function (object) {
                if (object.isMesh && object.geometry) {
                    object.geometry.computeBoundingBox();
                    const bbox = object.geometry.boundingBox;
                    if (bbox) {
                        minY = Math.min(minY, bbox.min.y * scale);
                    }
                }
            });
            mountain.position.y -= minY; // Adjust so the lowest point is at ground level

            mountain.traverse(function (object) {
                if (object.isMesh) {
                    object.castShadow = true;
                    object.receiveShadow = true;
                    // Apply realistic rock materials
                    if (object.material) {
                        if (object.material.map) {
                            object.material.map.colorSpace = THREE.SRGBColorSpace;
                        }
                        object.material.roughness = 0.95;
                        object.material.metalness = 0.0;
                        object.material.transparent = false;
                        object.material.depthWrite = true;
                        object.material.depthTest = true;
                        object.material.needsUpdate = true;
                    }
                }
            });

            scene.add(mountain);
            mountainMeshes.push(mountain);

            // Add mountain to obstacles for collision (large radius)
            obstacles.push({ x: pos.x, z: pos.z, radius: 20 });
        }, (error) => {
            console.warn(`Failed to load mountain model ${index + 1}, falling back to procedural mountain:`, error);
            // Fallback: create simple procedural mountain
            const mx = pos.x;
            const mz = pos.z;
            const mHeight = 30 + Math.random() * 30;
            const rad = mHeight * (0.5 + Math.random() * 0.4);
            const geo = new THREE.ConeGeometry(rad, mHeight, 32);

            const mat = new THREE.MeshStandardMaterial({
                color: 0x7b7b7b,
                roughness: 0.95,
                map: rockColor || null,
                normalMap: rockNormal || null,
                roughnessMap: rockRoughness || null
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(mx, mHeight * 0.5, mz); // Position so base is at ground (y=0)
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            mountainMeshes.push(mesh);
            obstacles.push({ x: mx, z: mz, radius: rad * 0.8 });
        });
    });
}

// Obstacles array for collision
const obstacles = [];

// Add cinematic quality trees instead of pine trees, avoiding building area (further reduction)
for (let i = 0; i < 18; i++) { // Further reduced to 18 trees
    let x, z, attempts = 0;
    const maxAttempts = 20;

    // Keep trying to find a position not too close to the building
    do {
        x = (Math.random() - 0.5) * 150; // Wider area with larger ground
        z = (Math.random() - 0.5) * 150;
        attempts++;

        // Check distance from building at (50, 50) - avoid placing trees within 25 units
        const distanceFromBuilding = Math.hypot(x - 50, z - 50);
        if (distanceFromBuilding >= 25 || attempts >= maxAttempts) {
            break;
        }
    } while (true);

    // Load cinematic tree model
    loadGLTFModel('assets/models/downloads/tree/rigged_animated_cinematic_quality_tree_2.glb', (gltf) => {
        const tree = gltf.scene;
        const scale = 0.8 + Math.random() * 0.4; // Varying scale
        tree.scale.set(scale, scale, scale);
        tree.position.set(x, 0, z);

        tree.traverse(function (object) {
            if (object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = true;
                // Apply realistic tree materials
                if (object.material) {
                    if (object.material.map) {
                        object.material.map.colorSpace = THREE.SRGBColorSpace;
                    }
                    object.material.roughness = 0.9;
                    object.material.metalness = 0.0;
                    object.material.needsUpdate = true;
                }
            }
        });

        scene.add(tree);
        trunkMeshes.push(tree); // Add to trunk meshes for texture updates
        obstacles.push({ x, z, radius: 2 }); // Smaller collision radius for trees

        // Try to play tree animations if available
        const mixer = new THREE.AnimationMixer(tree);
        if (gltf.animations && gltf.animations.length > 0) {
            const action = mixer.clipAction(gltf.animations[0]);
            action.play();
            action.timeScale = 0.5; // Slow animation for wind effect
        }
        mixers.push(mixer);
    }, (error) => {
        console.warn('Failed to load cinematic tree, falling back to pine tree:', error);
        // Fallback to pine tree
        const height = 8 + Math.random() * 12;
        const scale = 0.7 + Math.random() * 0.6;
        createPineTree(x, z, height, scale);
        obstacles.push({ x, z, radius: 3 });
    });
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
    // prefer PBR brick textures if available
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xefe4d1 });
    wallMaterials.push(wallMat);
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

    // Add door
    const doorGeo = new THREE.BoxGeometry(doorW, h, 0.1);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
    const door = new THREE.Mesh(doorGeo, doorMat);
    door.position.set(0, h / 2, halfD - 0.05);
    door.castShadow = true;
    houseGroup.add(door);
    // Store door for animation
    houseGroup.userData.door = door;
    // roof - use bark/wood texture if available for a rustic look
    const roofMatOpts = { color: 0x7a3b2a };
    if (barkColor) { roofMatOpts.map = barkColor; setTextureSRGB(barkColor); }
    if (barkNormal) roofMatOpts.normalMap = barkNormal;
    if (barkRoughness) { roofMatOpts.roughnessMap = barkRoughness; roofMatOpts.roughness = 1.0; }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.75, h * 0.8, 4), new THREE.MeshStandardMaterial(roofMatOpts));
    roof.rotation.y = Math.PI / 4;
    roof.position.set(0, h + 0.6, 0);
    roof.castShadow = true; roof.receiveShadow = false; houseGroup.add(roof);

    houseGroup.position.set(x, 0, z);
    scene.add(houseGroup);
    houses.push({ x, z, w, d, group: houseGroup });
}

// Replace procedural houses with 3D model houses
const housePositions = [
    { x: -30, z: 30 },
    { x: 35, z: 25 },
    { x: -20, z: -40 },
    { x: 40, z: -35 }
];

housePositions.forEach((pos, index) => {
    // Alternate between the two house models for variety
    const houseModel = index % 2 === 0
        ? 'assets/models/downloads/buildings/abandoned_house_3-low_poly.glb'
        : 'assets/models/downloads/buildings/school_house_7_bedford_nh__kendall_shoe_1847.glb';

    loadGLTFModel(houseModel, (gltf) => {
        const house = gltf.scene;
        house.scale.set(3.0, 3.0, 3.0); // Much larger for realistic house proportions
        house.position.set(pos.x, 0, pos.z);

        house.traverse(function (object) {
            if (object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = true;
                // Apply realistic house materials with better transparency handling
                if (object.material) {
                    if (object.material.map) {
                        object.material.map.colorSpace = THREE.SRGBColorSpace;
                    }
                    object.material.roughness = 0.8;
                    object.material.metalness = 0.1;
                    // Ensure proper rendering order and depth
                    object.material.transparent = false;
                    object.material.depthWrite = true;
                    object.material.depthTest = true;
                    object.material.needsUpdate = true;
                }
            }
        });

        scene.add(house);

        // Add house to obstacles for collision (smaller radius to allow entering houses)
        obstacles.push({ x: pos.x, z: pos.z, radius: 6 });
    }, (error) => {
        console.warn(`Failed to load house model ${index + 1}, falling back to procedural house:`, error);
        // Fallback to procedural house
        const sizes = [
            [7, 6, 4],
            [6, 8, 4],
            [8, 7, 4.5],
            [6, 6, 4]
        ];
        const [w, d, h] = sizes[index];
        createHouse(pos.x, pos.z, w, d, h);
    });
});

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

// Add futuristic city building
loadGLTFModel('assets/models/downloads/buildings/futuristic_city.glb', (gltf) => {
    const building = gltf.scene;
    building.scale.set(2.0, 2.0, 2.0); // Large scale for city building
    building.position.set(50, 0, 50); // Position in a large open area

    building.traverse(function (object) {
        if (object.isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
            // Apply realistic building materials
            if (object.material) {
                if (object.material.map) {
                    object.material.map.colorSpace = THREE.SRGBColorSpace;
                }
                object.material.roughness = 0.8;
                object.material.metalness = 0.2;
                object.material.needsUpdate = true;
            }
        }
    });

    scene.add(building);

    // Remove building collision to allow walking through/under it
    // obstacles.push({ x: 50, z: 50, radius: 8 }); // Commented out to allow free movement
}, (error) => {
    console.warn('Failed to load futuristic city building:', error);
});

// Add 8 large Soviet panel buildings in distant locations around the map
const sovietBuildingPositions = [
    { x: 140, z: 100 },
    { x: -130, z: 120 },
    { x: 100, z: -140 },
    { x: 160, z: -80 },
    { x: -110, z: -90 },
    { x: 70, z: 140 },
    { x: -80, z: 160 },
    { x: 130, z: 60 }
];

sovietBuildingPositions.forEach((pos, index) => {
    loadGLTFModel('assets/models/downloads/buildings/big_soviet_panel_house_lowpoly.glb', (gltf) => {
        const building = gltf.scene;
        building.scale.set(6.0, 12.0, 6.0); // 50% taller buildings (8.0 * 1.5 = 12.0)
        building.position.set(pos.x, 0, pos.z);

        building.traverse(function (object) {
            if (object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = true;
                // Apply realistic building materials
                if (object.material) {
                    if (object.material.map) {
                        object.material.map.colorSpace = THREE.SRGBColorSpace;
                    }
                    object.material.roughness = 0.9;
                    object.material.metalness = 0.0;
                    object.material.transparent = false;
                    object.material.depthWrite = true;
                    object.material.depthTest = true;
                    object.material.needsUpdate = true;
                }
            }
        });

        scene.add(building);

        // Add building to obstacles for collision (very large radius for big buildings)
        obstacles.push({ x: pos.x, z: pos.z, radius: 25 });
    }, (error) => {
        console.warn(`Failed to load Soviet building ${index + 1}:`, error);
    });
});

// Add mountain backdrop and river
// createMountains(); // Temporarily disabled

// Rocks
function createRock(x, z) {
    // Create a low-poly rock with vertex perturbation for a more natural shape
    const rockGeometry = new THREE.IcosahedronGeometry(0.5, 1); // Smaller size for realism
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
    rock.position.set(x, 0.25, z); // Lower position for smaller rocks
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
    rockMeshes.push(rock);
}

// Stones removed as requested


// Rain system
const rainDrops = [];
const rainCount = 1000;
const rainGeometry = new THREE.CylinderGeometry(0.05, 0.05, 2, 4);
const rainMaterial = new THREE.MeshBasicMaterial({ color: 0x87CEEB, transparent: true, opacity: 0.6 });

for (let i = 0; i < rainCount; i++) {
    const drop = new THREE.Mesh(rainGeometry, rainMaterial);
    drop.position.set(
        (Math.random() - 0.5) * 200,
        50 + Math.random() * 100,
        (Math.random() - 0.5) * 200
    );
    drop.rotation.z = Math.random() * Math.PI;
    drop.visible = false;
    scene.add(drop);
    rainDrops.push(drop);
}

let isRaining = false;
let rainTimer = 0;
const rainInterval = 60; // Rain every 60 seconds
const rainDuration = 10; // Rain for 10 seconds

function updateWeather(delta) {
    rainTimer += delta;
    if (rainTimer > rainInterval) {
        isRaining = true;
        rainTimer = 0;
    }
    if (isRaining) {
        if (rainTimer < rainDuration) {
            // Start or continue rain
            for (const drop of rainDrops) {
                drop.visible = true;
                drop.position.y -= 20 * delta; // Fall speed
                if (drop.position.y < 0) {
                    drop.position.y = 50 + Math.random() * 100;
                    drop.position.x = (Math.random() - 0.5) * 200;
                    drop.position.z = (Math.random() - 0.5) * 200;
                }
            }
            // Darken sky during rain (only if procedural sky is used)
            if (skyUniforms) skyUniforms['turbidity'].value = 5; // Reduce sky clarity
        } else {
            // Stop rain
            isRaining = false;
            for (const drop of rainDrops) {
                drop.visible = false;
            }
            // Restore sky (only if procedural sky is used)
            if (skyUniforms) skyUniforms['turbidity'].value = 10; // Restore sky clarity
        }
    }
}

// Bushes
function createBush(x, z) {
    // Build a bush from multiple grass blades using planes for realistic shape
    const bushGroup = new THREE.Group();
    const bladeCount = 20 + Math.floor(Math.random() * 20); // More blades for denser bush
    const bladeGeo = new THREE.PlaneGeometry(0.2, 1.0); // Width and height for grass blade
    const bladeMat = new THREE.MeshStandardMaterial({
        color: 0x00ff00,
        map: leafAlbedo || leavesTex || grassColor,
        alphaMap: leafAlpha,
        normalMap: leafNormal || grassNormal,
        roughnessMap: grassRoughness,
        roughness: 1.0,
        transparent: !!leafAlpha,
        alphaTest: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    if (bladeMat.map) setTextureSRGB(bladeMat.map);

    for (let i = 0; i < bladeCount; i++) {
        const blade = new THREE.Mesh(bladeGeo, bladeMat);
        // Position randomly within bush area
        blade.position.set((Math.random() - 0.5) * 2.0, Math.random() * 1.0, (Math.random() - 0.5) * 2.0);
        // Rotate randomly for natural look
        blade.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        // Scale slightly for variation
        const scale = 0.5 + Math.random() * 0.5;
        blade.scale.set(scale, scale, scale);
        blade.castShadow = true;
        blade.receiveShadow = true;
        bushGroup.add(blade);
    }
    bushGroup.position.set(x, 0, z);
    scene.add(bushGroup);
}

function createAnimatedHuman(x, z) {
    // Load high-quality Arezoo Soldier model - improved version with better materials and animations
    loadGLTFModel('assets/models/downloads/arezoo_solder_lowpolygon.glb', (gltf) => {
        const model = gltf.scene;
        // Add height variety - adjusted to be more realistic
        const heightVariation = Math.random();
        let humanScale;
        if (heightVariation < 0.2) {
            humanScale = 1.0; // 20% shorter people
        } else if (heightVariation < 0.9) {
            humanScale = 1.2; // 70% normal height people
        } else {
            humanScale = 1.4; // 10% taller people
        }
        model.scale.set(humanScale, humanScale, humanScale); // More realistic human height
        
        model.traverse(function (object) {
            if (object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = true;
                // Apply realistic human material properties for Metacreators model
                if (object.material) {
                    // Preserve original textures but enhance PBR properties
                    if (object.material.map) {
                        object.material.map.colorSpace = THREE.SRGBColorSpace;
                    }
                    object.material.roughness = 0.7;
                    object.material.metalness = 0.0;
                    object.material.envMapIntensity = 1.0;
                    object.material.needsUpdate = true;
                }
            }
        });
        
        scene.add(model);
        animatedHumans.push(model);
        obstacles.push({ x, z, radius: 1 });

        // Try to play animations from the Metacreators model
        const mixer = new THREE.AnimationMixer(model);
        if (gltf.animations && gltf.animations.length > 0) {
            console.log(`Metacreators model has ${gltf.animations.length} animations`);
            // Try to find a walking or idle animation
            let selectedAction = null;

            // Look for common animation names
            const walkAnim = gltf.animations.find(anim =>
                anim.name.toLowerCase().includes('walk') ||
                anim.name.toLowerCase().includes('run') ||
                anim.name.toLowerCase().includes('move')
            );

            const idleAnim = gltf.animations.find(anim =>
                anim.name.toLowerCase().includes('idle') ||
                anim.name.toLowerCase().includes('stand') ||
                anim.name.toLowerCase().includes('breathe')
            );

            // Prefer walking animation, fallback to first available
            const preferredAnim = walkAnim || idleAnim || gltf.animations[0];
            if (preferredAnim) {
                selectedAction = mixer.clipAction(preferredAnim);
                selectedAction.play();
                selectedAction.timeScale = 1.0; // Ensure normal speed
                console.log(`Playing animation: ${preferredAnim.name}`);
            }
        }
        mixers.push(mixer);

        // Enhanced movement logic with realistic AI behavior
        let walkTime = 0;
        const walkSpeed = 1.6;
        const runSpeed = 3.2;
        const humanMoveSpeed = 2.2;
        let direction = Math.random() * Math.PI * 2;
        let animationState = 'walking'; // walking, running, idle, turning, looking
        let stateTimer = 0;
        let targetDirection = direction;
        let turnSpeed = 0;
        let currentSpeed = humanMoveSpeed;
        let idleTime = 0;
        let walkCycle = 0;

        // Personality traits for varied behavior
        const personality = {
            activity: 0.3 + Math.random() * 0.7, // How active (0-1)
            curiosity: 0.2 + Math.random() * 0.8, // How likely to look around
            patience: 0.1 + Math.random() * 0.9   // How patient when idle
        };

        model.userData.animate = (delta) => {
            walkTime += delta;
            stateTimer += delta;
            walkCycle += delta * currentSpeed;

            // State management with realistic transitions
            if (animationState === 'walking' || animationState === 'running') {
                // Random state changes while moving
                if (Math.random() < personality.activity * 0.003) {
                    const states = ['idle', 'turning', 'looking'];
                    animationState = states[Math.floor(Math.random() * states.length)];
                    stateTimer = 0;
                    idleTime = 0;
                }

                // Occasional direction changes
                if (Math.random() < 0.008) {
                    targetDirection = direction + (Math.random() - 0.5) * Math.PI * 0.8;
                    turnSpeed = (Math.random() - 0.5) * 0.05;
                }

                // Smooth direction interpolation
                const angleDiff = targetDirection - direction;
                let shortestAngle = angleDiff;
                if (angleDiff > Math.PI) shortestAngle -= 2 * Math.PI;
                if (angleDiff < -Math.PI) shortestAngle += 2 * Math.PI;

                direction += shortestAngle * 0.02;
                model.rotation.y = direction;

                // Movement with slight bobbing
                const bob = Math.sin(walkCycle * 2) * 0.02;
                model.position.y = bob;

                const moveX = Math.cos(direction) * currentSpeed * delta;
                const moveZ = Math.sin(direction) * currentSpeed * delta;

                const newX = model.position.x + moveX;
                const newZ = model.position.z + moveZ;

                // Boundary check with more realistic behavior
                if (Math.abs(newX) > 85 || Math.abs(newZ) > 85) {
                    targetDirection = Math.atan2(-model.position.z, -model.position.x) + (Math.random() - 0.5) * Math.PI * 0.5;
                    stateTimer = 0;
                } else {
                    model.position.x = newX;
                    model.position.z = newZ;
                }

                // Update obstacle position for collision detection
                const obstacleIndex = obstacles.findIndex(obs => Math.abs(obs.x - model.position.x) < 0.1 && Math.abs(obs.z - model.position.z) < 0.1);
                if (obstacleIndex !== -1) {
                    obstacles[obstacleIndex].x = newX;
                    obstacles[obstacleIndex].z = newZ;
                }

                // Random speed variations
                if (Math.random() < 0.01) {
                    currentSpeed = humanMoveSpeed * (0.8 + Math.random() * 0.4);
                }

            } else if (animationState === 'idle') {
                idleTime += delta;

                // Breathing animation
                const breathe = Math.sin(walkTime * 2) * 0.005;
                model.position.y = breathe;

                // Subtle head movements
                if (Math.random() < personality.curiosity * 0.02) {
                    model.rotation.y += (Math.random() - 0.5) * 0.1;
                }

                // Return to walking after random time
                if (idleTime > personality.patience * (2 + Math.random() * 3)) {
                    animationState = 'walking';
                    stateTimer = 0;
                    idleTime = 0;
                }

            } else if (animationState === 'turning') {
                // Smooth turning animation
                targetDirection += turnSpeed;
                turnSpeed *= 0.95; // Slow down turning

                const angleDiff = targetDirection - direction;
                let shortestAngle = angleDiff;
                if (angleDiff > Math.PI) shortestAngle -= 2 * Math.PI;
                if (angleDiff < -Math.PI) shortestAngle += 2 * Math.PI;

                direction += shortestAngle * 0.03;
                model.rotation.y = direction;

                if (stateTimer > 1 + Math.random() * 2) {
                    animationState = 'walking';
                    stateTimer = 0;
                }

            } else if (animationState === 'looking') {
                // Looking around animation
                const lookAngle = Math.sin(stateTimer * 2) * Math.PI * 0.3;
                model.rotation.y = direction + lookAngle;

                if (stateTimer > 2 + Math.random() * 2) {
                    animationState = 'walking';
                    stateTimer = 0;
                    model.rotation.y = direction; // Reset to movement direction
                }
            }
        };

    }, (error) => {
        console.warn('Failed to load Metacreators human model, falling back to CesiumMan:', error);
        // Fallback to CesiumMan model
        loadGLTFModel('assets/models/cesium_man.glb', (gltf) => {
            const model = gltf.scene;
            // Add height variety for CesiumMan fallback model - reduced heights
            const heightVariation = Math.random();
            let humanScale;
            if (heightVariation < 0.2) {
                humanScale = 1.0; // 20% shorter people
            } else if (heightVariation < 0.9) {
                humanScale = 1.2; // 70% normal height people
            } else {
                humanScale = 1.4; // 10% taller people
            }
            model.scale.set(humanScale, humanScale, humanScale); // More realistic human height
            model.traverse(function (object) {
                if (object.isMesh) {
                    object.castShadow = true;
                    object.receiveShadow = true;
                    // Apply realistic human material properties
                    if (object.material) {
                        object.material.roughness = 0.8;
                        object.material.metalness = 0.0;
                        // The CesiumMan model already has embedded textures
                        object.material.needsUpdate = true;
                    }
                }
            });
            scene.add(model);
            animatedHumans.push(model);
            obstacles.push({ x, z, radius: 1 });

            // The CesiumMan model has embedded animations - try to play them
            const mixer = new THREE.AnimationMixer(model);
            if (gltf.animations && gltf.animations.length > 0) {
                const action = mixer.clipAction(gltf.animations[0]);
                action.play();
                action.timeScale = 1.0; // Ensure normal speed
            }
            mixers.push(mixer);

            // Enhanced movement logic with realistic AI behavior
            let walkTime = 0;
            const walkSpeed = 1.6;
            const runSpeed = 3.2;
            const humanMoveSpeed = 2.2;
            let direction = Math.random() * Math.PI * 2;
            let animationState = 'walking'; // walking, running, idle, turning, looking
            let stateTimer = 0;
            let targetDirection = direction;
            let turnSpeed = 0;
            let currentSpeed = humanMoveSpeed;
            let idleTime = 0;
            let walkCycle = 0;

            // Personality traits for varied behavior
            const personality = {
                activity: 0.3 + Math.random() * 0.7, // How active (0-1)
                curiosity: 0.2 + Math.random() * 0.8, // How likely to look around
                patience: 0.1 + Math.random() * 0.9   // How patient when idle
            };

            model.userData.animate = (delta) => {
                walkTime += delta;
                stateTimer += delta;
                walkCycle += delta * currentSpeed;
    
                // State management with realistic transitions
                if (animationState === 'walking' || animationState === 'running') {
                    // Random state changes while moving
                    if (Math.random() < personality.activity * 0.003) {
                        const states = ['idle', 'turning', 'looking'];
                        animationState = states[Math.floor(Math.random() * states.length)];
                        stateTimer = 0;
                        idleTime = 0;
                    }
    
                    // Occasional direction changes
                    if (Math.random() < 0.008) {
                        targetDirection = direction + (Math.random() - 0.5) * Math.PI * 0.8;
                        turnSpeed = (Math.random() - 0.5) * 0.05;
                    }
    
                    // Smooth direction interpolation
                    const angleDiff = targetDirection - direction;
                    let shortestAngle = angleDiff;
                    if (angleDiff > Math.PI) shortestAngle -= 2 * Math.PI;
                    if (angleDiff < -Math.PI) shortestAngle += 2 * Math.PI;
    
                    direction += shortestAngle * 0.02;
                    model.rotation.y = direction;
    
                    // Movement with slight bobbing
                    const bob = Math.sin(walkCycle * 2) * 0.02;
                    model.position.y = bob;
    
                    const moveX = Math.cos(direction) * currentSpeed * delta;
                    const moveZ = Math.sin(direction) * currentSpeed * delta;
    
                    const newX = model.position.x + moveX;
                    const newZ = model.position.z + moveZ;
    
                    // Boundary check with more realistic behavior
                    if (Math.abs(newX) > 85 || Math.abs(newZ) > 85) {
                        targetDirection = Math.atan2(-model.position.z, -model.position.x) + (Math.random() - 0.5) * Math.PI * 0.5;
                        stateTimer = 0;
                    } else {
                        model.position.x = newX;
                        model.position.z = newZ;
                    }
    
                    // Update obstacle position for collision detection
                    const obstacleIndex = obstacles.findIndex(obs => Math.abs(obs.x - model.position.x) < 0.1 && Math.abs(obs.z - model.position.z) < 0.1);
                    if (obstacleIndex !== -1) {
                        obstacles[obstacleIndex].x = newX;
                        obstacles[obstacleIndex].z = newZ;
                    }
    
                    // Random speed variations
                    if (Math.random() < 0.01) {
                        currentSpeed = humanMoveSpeed * (0.8 + Math.random() * 0.4);
                    }
    
                } else if (animationState === 'idle') {
                    idleTime += delta;

                    // Breathing animation
                    const breathe = Math.sin(walkTime * 2) * 0.005;
                    model.position.y = breathe;

                    // Subtle head movements
                    if (Math.random() < personality.curiosity * 0.02) {
                        model.rotation.y += (Math.random() - 0.5) * 0.1;
                    }

                    // Return to walking after random time
                    if (idleTime > personality.patience * (2 + Math.random() * 3)) {
                        animationState = 'walking';
                        stateTimer = 0;
                        idleTime = 0;
                    }

                } else if (animationState === 'turning') {
                    // Smooth turning animation
                    targetDirection += turnSpeed;
                    turnSpeed *= 0.95; // Slow down turning

                    const angleDiff = targetDirection - direction;
                    let shortestAngle = angleDiff;
                    if (angleDiff > Math.PI) shortestAngle -= 2 * Math.PI;
                    if (angleDiff < -Math.PI) shortestAngle += 2 * Math.PI;

                    direction += shortestAngle * 0.03;
                    model.rotation.y = direction;

                    if (stateTimer > 1 + Math.random() * 2) {
                        animationState = 'walking';
                        stateTimer = 0;
                    }

                } else if (animationState === 'looking') {
                    // Looking around animation
                    const lookAngle = Math.sin(stateTimer * 2) * Math.PI * 0.3;
                    model.rotation.y = direction + lookAngle;

                    if (stateTimer > 2 + Math.random() * 2) {
                        animationState = 'walking';
                        stateTimer = 0;
                        model.rotation.y = direction; // Reset to movement direction
                    }
                }
            };
        }, (fallbackError) => {
            console.warn('Failed to load CesiumMan model, using custom human:', fallbackError);
            createCustomHuman(x, z);
        });
    });
}

function createRealisticDuck(x, z) {
    // Load high-quality duck model from Khronos Group sample models
    loadGLTFModel('assets/models/duck.glb', (gltf) => {
        const model = gltf.scene;
        model.position.set(x, 0, z);
        model.scale.set(0.4, 0.4, 0.4); // Smaller size as requested
        model.traverse(function (object) {
            if (object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = true;
                // Apply realistic duck material properties
                if (object.material) {
                    object.material.roughness = 0.6;
                    object.material.metalness = 0.0;
                    // Make it more yellow if possible
                    if (object.material.color) {
                        object.material.color.setHex(0xFFFF00); // Bright yellow
                    }
                    object.material.needsUpdate = true;
                }
            }
        });
        scene.add(model);
        animatedHumans.push(model); // Reuse the array for ducks too
        obstacles.push({ x, z, radius: 0.8 });

        // The Khronos Duck model has embedded animations - try to play them
        const mixer = new THREE.AnimationMixer(model);
        if (gltf.animations && gltf.animations.length > 0) {
            const action = mixer.clipAction(gltf.animations[0]);
            action.play();
            action.timeScale = 1.0; // Ensure normal speed
        }
        mixers.push(mixer);

        // Add movement logic
        let animationTime = 0;
        const duckMoveSpeed = 1.5;
        let direction = Math.random() * Math.PI * 2;
        let isSwimming = Math.random() < 0.6; // 60% chance of swimming

        model.userData.animate = (delta) => {
            animationTime += delta;

            // Random direction changes - more frequent
            if (Math.random() < 0.02) {
                direction = Math.random() * Math.PI * 2;
                isSwimming = Math.random() < 0.6;
            }

            // Movement - actually move the duck
            const currentSpeed = isSwimming ? duckMoveSpeed * 1.5 : duckMoveSpeed;
            const moveX = Math.cos(direction) * currentSpeed * delta;
            const moveZ = Math.sin(direction) * currentSpeed * delta;

            const newX = model.position.x + moveX;
            const newZ = model.position.z + moveZ;

            // Boundary check
            if (Math.abs(newX) > 90 || Math.abs(newZ) > 90) {
                direction = Math.random() * Math.PI * 2;
            } else {
                model.position.x = newX;
                model.position.z = newZ;
            }

            model.rotation.y = direction;

            // Update obstacle position for collision detection
            const obstacleIndex = obstacles.findIndex(obs => Math.abs(obs.x - model.position.x) < 0.1 && Math.abs(obs.z - model.position.z) < 0.1);
            if (obstacleIndex !== -1) {
                obstacles[obstacleIndex].x = newX;
                obstacles[obstacleIndex].z = newZ;
            }
        };
    }, (error) => {
        console.warn('Failed to load high-quality duck model, falling back to custom:', error);
        createCustomDuck(x, z);
    });
}

function createCustomDuck(x, z) {
    // Create a highly detailed, realistic yellow duck
    const duckGroup = new THREE.Group();

    // Body - more realistic duck shape
    const bodyGeometry = new THREE.SphereGeometry(0.28, 20, 16);
    bodyGeometry.scale(1.1, 0.75, 1.3); // Proper duck proportions
    const bodyMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFFF00, // Bright yellow body
        roughness: 0.6,
        metalness: 0.0
    });

    // Try to load realistic duck texture
    tryLoadTexture('https://threejs.org/examples/textures/terrain/grasslight-big.jpg', 'https://threejs.org/examples/textures/terrain/grasslight-big.jpg', (texture) => {
        bodyMaterial.map = texture;
        setTextureSRGB(texture);
        bodyMaterial.needsUpdate = true;
    });

    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, 0.18, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    duckGroup.add(body);

    // Head - more rounded and proportional
    const headGeometry = new THREE.SphereGeometry(0.2, 16, 12);
    const headMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFFF00, // Yellow head
        roughness: 0.5,
        metalness: 0.0
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 0.5, 0.25);
    head.castShadow = true;
    head.receiveShadow = true;
    duckGroup.add(head);

    // Beak - more detailed
    const beakGeometry = new THREE.ConeGeometry(0.06, 0.2, 8);
    const beakMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFA500, // Orange beak
        roughness: 0.8,
        metalness: 0.0
    });
    const beak = new THREE.Mesh(beakGeometry, beakMaterial);
    beak.position.set(0, 0.45, 0.4);
    beak.rotation.x = Math.PI / 2;
    beak.castShadow = true;
    duckGroup.add(beak);

    // Eyes - more prominent
    const eyeGeometry = new THREE.SphereGeometry(0.03, 8, 6);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.07, 0.53, 0.3);
    duckGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.07, 0.53, 0.3);
    duckGroup.add(rightEye);

    // Eye highlights
    const highlightGeometry = new THREE.SphereGeometry(0.01, 6, 4);
    const highlightMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    const leftHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    leftHighlight.position.set(-0.065, 0.535, 0.32);
    duckGroup.add(leftHighlight);

    const rightHighlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    rightHighlight.position.set(0.065, 0.535, 0.32);
    duckGroup.add(rightHighlight);

    // Wings - more detailed
    const wingGeometry = new THREE.BoxGeometry(0.18, 0.06, 0.4);
    wingGeometry.scale(1, 1, 0.8); // Taper the wings
    const wingMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFFF88, // Slightly lighter yellow for wings
        roughness: 0.7,
        metalness: 0.0
    });

    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
    leftWing.position.set(-0.28, 0.22, 0);
    leftWing.castShadow = true;
    leftWing.receiveShadow = true;
    leftWing.name = 'leftWing'; // Add name for animation detection
    duckGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
    rightWing.position.set(0.28, 0.22, 0);
    rightWing.castShadow = true;
    rightWing.receiveShadow = true;
    rightWing.name = 'rightWing'; // Add name for animation detection
    duckGroup.add(rightWing);

    // Legs - more realistic
    const legGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.25, 8);
    const legMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFA500, // Orange legs
        roughness: 0.9,
        metalness: 0.0
    });

    const leftLeg = new THREE.Mesh(legGeometry, legMaterial);
    leftLeg.position.set(-0.15, -0.08, 0.12);
    leftLeg.castShadow = true;
    leftLeg.name = 'leftLeg'; // Add name for animation detection
    duckGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(legGeometry, legMaterial);
    rightLeg.position.set(0.15, -0.08, 0.12);
    rightLeg.castShadow = true;
    rightLeg.name = 'rightLeg'; // Add name for animation detection
    duckGroup.add(rightLeg);

    // Feet (webbed) - more detailed
    const footGeometry = new THREE.BoxGeometry(0.1, 0.015, 0.15);
    const footMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFA500,
        roughness: 0.9,
        metalness: 0.0
    });

    const leftFoot = new THREE.Mesh(footGeometry, footMaterial);
    leftFoot.position.set(-0.15, -0.18, 0.18);
    leftFoot.castShadow = true;
    leftFoot.name = 'leftFoot'; // Add name for animation detection
    duckGroup.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeometry, footMaterial);
    rightFoot.position.set(0.15, -0.18, 0.18);
    rightFoot.castShadow = true;
    rightFoot.name = 'rightFoot'; // Add name for animation detection
    duckGroup.add(rightFoot);

    // Also name other duck body parts
    body.name = 'body';
    head.name = 'head';

    // Tail - more prominent
    const tailGeometry = new THREE.ConeGeometry(0.1, 0.2, 8);
    const tailMaterial = new THREE.MeshStandardMaterial({
        color: 0xFFFF00,
        roughness: 0.7,
        metalness: 0.0
    });
    const tail = new THREE.Mesh(tailGeometry, tailMaterial);
    tail.position.set(0, 0.18, -0.3);
    tail.rotation.x = -Math.PI / 4;
    tail.castShadow = true;
    duckGroup.add(tail);

    // Position the duck
    duckGroup.position.set(x, 0, z);

    // Scale down the custom duck
    duckGroup.scale.set(0.5, 0.5, 0.5); // Smaller size

    // Add duck animation
    addDuckAnimation(duckGroup);

    scene.add(duckGroup);
    animatedHumans.push(duckGroup); // Reuse the array
    obstacles.push({ x, z, radius: 0.4 }); // Smaller radius for smaller duck
}

function addDuckAnimation(duckGroup) {
    let animationTime = 0;
    const swimSpeed = 1.2;
    const walkSpeed = 0.8;
    const duckMoveSpeed = 1.5;
    let direction = Math.random() * Math.PI * 2;
    let isSwimming = Math.random() < 0.6; // 60% chance of swimming

    // Get references to body parts (for loaded GLTF model)
    let body, head, leftWing, rightWing, leftLeg, rightLeg;

    if (duckGroup.children && duckGroup.children.length > 0) {
        // Enhanced duck body part detection with better logic
        duckGroup.traverse((child) => {
            if (child.isMesh || child.type === 'Group') {
                const name = child.name.toLowerCase();
                const pos = child.position;
                
                // Better duck part detection
                if (name.includes('body') || name.includes('torso') ||
                    (child.geometry && child.geometry.type === 'SphereGeometry' && pos.y < 0.4)) {
                    body = child;
                } else if (name.includes('head') ||
                    (child.geometry && child.geometry.type === 'SphereGeometry' && pos.y > 0.4)) {
                    head = child;
                } else if (name.includes('wing') && (pos.x < -0.2 || name.includes('left'))) {
                    leftWing = child;
                } else if (name.includes('wing') && (pos.x > 0.2 || name.includes('right'))) {
                    rightWing = child;
                } else if (name.includes('leg') && (pos.x < -0.1 || name.includes('left'))) {
                    leftLeg = child;
                } else if (name.includes('leg') && (pos.x > 0.1 || name.includes('right'))) {
                    rightLeg = child;
                }
                
                // Fallback detection by geometry and position
                if (!body && child.geometry) {
                    if (child.geometry.type === 'SphereGeometry') {
                        body = child;
                    }
                }
                
                if (!head && child.geometry) {
                    if (child.geometry.type === 'SphereGeometry' && pos.y > 0.4) {
                        head = child;
                    }
                }
            }
        });
        
        // Debug logging to see what duck parts were found
        console.log('Duck body parts detected:', {
            body: !!body,
            head: !!head,
            leftWing: !!leftWing,
            rightWing: !!rightWing,
            leftLeg: !!leftLeg,
            rightLeg: !!rightLeg
        });
    }

    // Store the animation function to be called from main loop
    duckGroup.userData = duckGroup.userData || {};
    duckGroup.userData.animate = (delta) => {
        animationTime += delta;

        // Random direction changes - more frequent
        if (Math.random() < 0.02) {
            direction = Math.random() * Math.PI * 2;
            isSwimming = Math.random() < 0.6;
        }

        // Movement - actually move the duck
        const currentSpeed = isSwimming ? duckMoveSpeed * 1.5 : duckMoveSpeed;
        const moveX = Math.cos(direction) * currentSpeed * delta;
        const moveZ = Math.sin(direction) * currentSpeed * delta;

        const newX = duckGroup.position.x + moveX;
        const newZ = duckGroup.position.z + moveZ;

        // Boundary check
        if (Math.abs(newX) > 90 || Math.abs(newZ) > 90) {
            direction = Math.random() * Math.PI * 2;
        } else {
            duckGroup.position.x = newX;
            duckGroup.position.z = newZ;
        }

        duckGroup.rotation.y = direction;

        // Update obstacle position for collision detection
        const obstacleIndex = obstacles.findIndex(obs => Math.abs(obs.x - duckGroup.position.x) < 0.1 && Math.abs(obs.z - duckGroup.position.z) < 0.1);
        if (obstacleIndex !== -1) {
            obstacles[obstacleIndex].x = newX;
            obstacles[obstacleIndex].z = newZ;
        }

        if (isSwimming) {
            // Swimming animation - subtle bobbing
            const bob = Math.sin(animationTime * swimSpeed) * 0.02;
            duckGroup.position.y = bob;

            // Wing flapping for swimming
            if (leftWing) leftWing.rotation.z = Math.sin(animationTime * swimSpeed * 2) * 0.3;
            if (rightWing) rightWing.rotation.z = -Math.sin(animationTime * swimSpeed * 2) * 0.3;

            // Legs tucked in while swimming
            if (leftLeg) leftLeg.visible = false;
            if (rightLeg) rightLeg.visible = false;
        } else {
            // Walking animation
            const bob = Math.sin(animationTime * walkSpeed) * 0.015;
            duckGroup.position.y = bob;

            // Wing subtle movement
            if (leftWing) leftWing.rotation.z = Math.sin(animationTime * walkSpeed) * 0.1;
            if (rightWing) rightWing.rotation.z = -Math.sin(animationTime * walkSpeed) * 0.1;

            // Legs visible and moving while walking
            if (leftLeg) {
                leftLeg.visible = true;
                leftLeg.rotation.x = Math.sin(animationTime * walkSpeed) * 0.2;
            }
            if (rightLeg) {
                rightLeg.visible = true;
                rightLeg.rotation.x = -Math.sin(animationTime * walkSpeed) * 0.2;
            }
        }

        // Head bobbing
        if (head) head.position.y = 0.45 + Math.sin(animationTime * 3) * 0.005;
    };
}

function createCustomHuman(x, z) {
    // Create a highly detailed, realistic human figure with proper anatomy
    const humanGroup = new THREE.Group();

    // Torso - more anatomically correct
    const torsoGeometry = new THREE.CapsuleGeometry(0.32, 0.85, 12, 20);
    const torsoMaterial = new THREE.MeshStandardMaterial({
        color: 0x4a90e2, // Blue shirt
        roughness: 0.7,
        metalness: 0.0
    });

    // Try to load clothing texture
    tryLoadTexture('https://threejs.org/examples/textures/brick_diffuse.jpg', 'https://threejs.org/examples/textures/brick_diffuse.jpg', (texture) => {
        torsoMaterial.map = texture;
        setTextureSRGB(texture);
        torsoMaterial.needsUpdate = true;
    });

    const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
    torso.position.set(0, 0.42, 0);
    torso.castShadow = true;
    torso.receiveShadow = true;
    humanGroup.add(torso);

    // Head - anatomically correct proportions
    const headGeometry = new THREE.SphereGeometry(0.21, 20, 16);
    headGeometry.scale(0.95, 1.1, 0.9); // Slightly oval shape
    const headMaterial = new THREE.MeshStandardMaterial({
        color: 0xf5c89c, // Realistic skin tone
        roughness: 0.6,
        metalness: 0.0
    });

    // Load skin texture
    if (skinColor) {
        headMaterial.map = skinColor;
        setTextureSRGB(skinColor);
    } else {
        tryLoadTexture('https://threejs.org/examples/textures/brick_diffuse.jpg', 'https://threejs.org/examples/textures/brick_diffuse.jpg', (texture) => {
            headMaterial.map = texture;
            setTextureSRGB(texture);
            headMaterial.needsUpdate = true;
        });
    }

    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 1.12, 0);
    head.castShadow = true;
    head.receiveShadow = true;
    humanGroup.add(head);

    // Eyes - more detailed
    const eyeGeometry = new THREE.SphereGeometry(0.028, 12, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x2c3e50 }); // Dark brown eyes

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.075, 1.15, 0.19);
    humanGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.075, 1.15, 0.19);
    humanGroup.add(rightEye);

    // Eyebrows
    const eyebrowGeometry = new THREE.BoxGeometry(0.04, 0.005, 0.02);
    const eyebrowMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });

    const leftEyebrow = new THREE.Mesh(eyebrowGeometry, eyebrowMaterial);
    leftEyebrow.position.set(-0.075, 1.18, 0.195);
    humanGroup.add(leftEyebrow);

    const rightEyebrow = new THREE.Mesh(eyebrowGeometry, eyebrowMaterial);
    rightEyebrow.position.set(0.075, 1.18, 0.195);
    humanGroup.add(rightEyebrow);

    // Nose - more detailed
    const noseGeometry = new THREE.ConeGeometry(0.025, 0.1, 8);
    const noseMaterial = new THREE.MeshStandardMaterial({
        color: 0xe8b4a2,
        roughness: 0.5,
        metalness: 0.0
    });
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.position.set(0, 1.08, 0.21);
    nose.rotation.x = Math.PI / 2;
    humanGroup.add(nose);

    // Mouth - more realistic
    const mouthGeometry = new THREE.TorusGeometry(0.025, 0.008, 8, 16, Math.PI);
    const mouthMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
    const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouth.position.set(0, 1.04, 0.19);
    mouth.rotation.x = Math.PI / 2;
    humanGroup.add(mouth);

    // Hair
    const hairGeometry = new THREE.SphereGeometry(0.23, 16, 12);
    hairGeometry.scale(1, 0.8, 1);
    const hairMaterial = new THREE.MeshStandardMaterial({
        color: 0x8B4513, // Brown hair
        roughness: 0.9,
        metalness: 0.0
    });
    const hair = new THREE.Mesh(hairGeometry, hairMaterial);
    hair.position.set(0, 1.18, -0.02);
    hair.castShadow = true;
    humanGroup.add(hair);

    // Arms - anatomically correct proportions
    const upperArmGeometry = new THREE.CapsuleGeometry(0.11, 0.35, 8, 16);
    const lowerArmGeometry = new THREE.CapsuleGeometry(0.09, 0.35, 8, 16);
    const armMaterial = new THREE.MeshStandardMaterial({
        color: 0xf5c89c, // Skin tone
        roughness: 0.7,
        metalness: 0.0
    });

    if (skinColor) {
        armMaterial.map = skinColor;
        setTextureSRGB(skinColor);
    }

    // Left arm - with proper naming for animation detection
    const leftUpperArm = new THREE.Mesh(upperArmGeometry, armMaterial);
    leftUpperArm.position.set(-0.48, 0.6, 0);
    leftUpperArm.rotation.z = 0.3;
    leftUpperArm.castShadow = true;
    leftUpperArm.receiveShadow = true;
    leftUpperArm.name = 'leftUpperArm'; // Add name for animation detection
    humanGroup.add(leftUpperArm);

    const leftLowerArm = new THREE.Mesh(lowerArmGeometry, armMaterial);
    leftLowerArm.position.set(-0.65, 0.25, 0);
    leftLowerArm.rotation.z = 0.2;
    leftLowerArm.castShadow = true;
    leftLowerArm.receiveShadow = true;
    leftLowerArm.name = 'leftLowerArm'; // Add name for animation detection
    humanGroup.add(leftLowerArm);

    // Right arm
    const rightUpperArm = new THREE.Mesh(upperArmGeometry, armMaterial);
    rightUpperArm.position.set(0.48, 0.6, 0);
    rightUpperArm.rotation.z = -0.3;
    rightUpperArm.castShadow = true;
    rightUpperArm.receiveShadow = true;
    rightUpperArm.name = 'rightUpperArm'; // Add name for animation detection
    humanGroup.add(rightUpperArm);

    const rightLowerArm = new THREE.Mesh(lowerArmGeometry, armMaterial);
    rightLowerArm.position.set(0.65, 0.25, 0);
    rightLowerArm.rotation.z = -0.2;
    rightLowerArm.castShadow = true;
    rightLowerArm.receiveShadow = true;
    rightLowerArm.name = 'rightLowerArm'; // Add name for animation detection
    humanGroup.add(rightLowerArm);

    // Legs - anatomically correct
    const upperLegGeometry = new THREE.CapsuleGeometry(0.14, 0.5, 8, 16);
    const lowerLegGeometry = new THREE.CapsuleGeometry(0.12, 0.5, 8, 16);
    const legMaterial = new THREE.MeshStandardMaterial({
        color: 0x2c3e50, // Dark pants
        roughness: 0.8,
        metalness: 0.0
    });

    // Left leg
    const leftUpperLeg = new THREE.Mesh(upperLegGeometry, legMaterial);
    leftUpperLeg.position.set(-0.2, -0.25, 0);
    leftUpperLeg.castShadow = true;
    leftUpperLeg.receiveShadow = true;
    leftUpperLeg.name = 'leftUpperLeg'; // Add name for animation detection
    humanGroup.add(leftUpperLeg);

    const leftLowerLeg = new THREE.Mesh(lowerLegGeometry, legMaterial);
    leftLowerLeg.position.set(-0.2, -0.75, 0);
    leftLowerLeg.castShadow = true;
    leftLowerLeg.receiveShadow = true;
    leftLowerLeg.name = 'leftLowerLeg'; // Add name for animation detection
    humanGroup.add(leftLowerLeg);

    // Right leg
    const rightUpperLeg = new THREE.Mesh(upperLegGeometry, legMaterial);
    rightUpperLeg.position.set(0.2, -0.25, 0);
    rightUpperLeg.castShadow = true;
    rightUpperLeg.receiveShadow = true;
    rightUpperLeg.name = 'rightUpperLeg'; // Add name for animation detection
    humanGroup.add(rightUpperLeg);

    const rightLowerLeg = new THREE.Mesh(lowerLegGeometry, legMaterial);
    rightLowerLeg.position.set(0.2, -0.75, 0);
    rightLowerLeg.castShadow = true;
    rightLowerLeg.receiveShadow = true;
    rightLowerLeg.name = 'rightLowerLeg'; // Add name for animation detection
    humanGroup.add(rightLowerLeg);

    // Feet - anatomically correct
    const footGeometry = new THREE.BoxGeometry(0.25, 0.08, 0.4);
    const footMaterial = new THREE.MeshStandardMaterial({
        color: 0x1a1a1a, // Black shoes
        roughness: 0.7,
        metalness: 0.1
    });

    const leftFoot = new THREE.Mesh(footGeometry, footMaterial);
    leftFoot.position.set(-0.2, -1.25, 0.15);
    leftFoot.castShadow = true;
    leftFoot.receiveShadow = true;
    leftFoot.name = 'leftFoot'; // Add name for animation detection
    humanGroup.add(leftFoot);

    const rightFoot = new THREE.Mesh(footGeometry, footMaterial);
    rightFoot.position.set(0.2, -1.25, 0.15);
    rightFoot.castShadow = true;
    rightFoot.receiveShadow = true;
    rightFoot.name = 'rightFoot'; // Add name for animation detection
    humanGroup.add(rightFoot);

    // Also name other body parts for better detection
    torso.name = 'torso';
    head.name = 'head';

    // Position the human
    humanGroup.position.set(x, 0, z);

    // Add height variety to custom humans - reduced heights for better proportions
    const heightVariation = Math.random();
    let humanScale;
    if (heightVariation < 0.2) {
        humanScale = 1.0; // 20% shorter people
    } else if (heightVariation < 0.9) {
        humanScale = 1.2; // 70% normal height people
    } else {
        humanScale = 1.4; // 10% taller people
    }
    humanGroup.scale.set(humanScale, humanScale, humanScale); // More realistic human height

    // Add comprehensive human animations
    addHumanAnimation(humanGroup);

    scene.add(humanGroup);
    animatedHumans.push(humanGroup);
    obstacles.push({ x, z, radius: 1.3 }); // Adjusted radius for human size
}

function addHumanAnimation(humanGroup) {
    let walkTime = 0;
    const walkSpeed = 1.6;
    const runSpeed = 3.2;
    const currentSpeed = walkSpeed; // Can be adjusted for different speeds
    const walkAmplitude = 0.025;
    const runAmplitude = 0.05;
    const humanMoveSpeed = 1.25;
    let direction = Math.random() * Math.PI * 2;
    let animationState = 'walking'; // walking, running, idle, turning
    let stateTimer = 0;
    let transitionTimer = 0;
    let isTransitioning = false;

    // Animation phases for more realistic movement
    let leftLegPhase = 0;
    let rightLegPhase = Math.PI; // Offset for opposite leg
    let leftArmPhase = Math.PI;  // Opposite arm to leg
    let rightArmPhase = 0;

    // Get references to body parts for animation (for loaded GLTF model)
    let torso, head, leftUpperArm, rightUpperArm, leftLowerArm, rightLowerArm;
    let leftUpperLeg, rightUpperLeg, leftLowerLeg, rightLowerLeg, leftFoot, rightFoot;

    if (humanGroup.children && humanGroup.children.length > 0) {
        // Enhanced body part detection with better logic for all model types
        humanGroup.traverse((child) => {
            if (child.isMesh || child.type === 'Group') {
                const name = child.name.toLowerCase();
                const pos = child.position;
                
                // More flexible detection for different model types
                if (name.includes('torso') || name.includes('body') || name.includes('chest') ||
                    (child.geometry && child.geometry.type === 'CapsuleGeometry' && pos.y > 0.3)) {
                    torso = child;
                } else if (name.includes('head') || name.includes('skull') ||
                    (child.geometry && child.geometry.type === 'SphereGeometry' && pos.y > 1)) {
                    head = child;
                } else if (name.includes('arm') && name.includes('upper') || name.includes('upperarm') ||
                    (name.includes('arm') && pos.x < -0.4 && pos.y > 0.5 && !name.includes('lower'))) {
                    leftUpperArm = child;
                } else if (name.includes('arm') && name.includes('upper') || name.includes('upperarm') ||
                    (name.includes('arm') && pos.x > 0.4 && pos.y > 0.5 && !name.includes('lower'))) {
                    rightUpperArm = child;
                } else if (name.includes('arm') && name.includes('lower') || name.includes('forearm') ||
                    (name.includes('arm') && pos.x < -0.6 && pos.y < 0.4)) {
                    leftLowerArm = child;
                } else if (name.includes('arm') && name.includes('lower') || name.includes('forearm') ||
                    (name.includes('arm') && pos.x > 0.6 && pos.y < 0.4)) {
                    rightLowerArm = child;
                } else if ((name.includes('leg') && name.includes('upper')) || name.includes('thigh') ||
                    (name.includes('leg') && pos.x < -0.1 && pos.y < -0.1 && pos.y > -0.5)) {
                    leftUpperLeg = child;
                } else if ((name.includes('leg') && name.includes('upper')) || name.includes('thigh') ||
                    (name.includes('leg') && pos.x > 0.1 && pos.y < -0.1 && pos.y > -0.5)) {
                    rightUpperLeg = child;
                } else if (name.includes('leg') && name.includes('lower') || name.includes('shin') ||
                    (name.includes('leg') && pos.x < -0.1 && pos.y < -0.6)) {
                    leftLowerLeg = child;
                } else if (name.includes('leg') && name.includes('lower') || name.includes('shin') ||
                    (name.includes('leg') && pos.x > 0.1 && pos.y < -0.6)) {
                    rightLowerLeg = child;
                } else if (name.includes('foot') || name.includes('feet') ||
                    (pos.x < -0.1 && pos.y < -1.1 && pos.z > 0)) {
                    leftFoot = child;
                } else if (name.includes('foot') || name.includes('feet') ||
                    (pos.x > 0.1 && pos.y < -1.1 && pos.z > 0)) {
                    rightFoot = child;
                }
                
                // Additional fallback: Try to identify by geometry type and relative position
                if (!leftUpperArm && child.geometry) {
                    if (child.geometry.type === 'CapsuleGeometry' && pos.x < -0.3 && pos.y > 0.4) {
                        leftUpperArm = child;
                    } else if (child.geometry.type === 'CapsuleGeometry' && pos.x > 0.3 && pos.y > 0.4) {
                        rightUpperArm = child;
                    }
                }
                
                if (!leftUpperLeg && child.geometry) {
                    if (child.geometry.type === 'CapsuleGeometry' && pos.x < 0 && pos.y < 0 && pos.y > -0.6) {
                        leftUpperLeg = child;
                    } else if (child.geometry.type === 'CapsuleGeometry' && pos.x > 0 && pos.y < 0 && pos.y > -0.6) {
                        rightUpperLeg = child;
                    }
                }
            }
        });
        
        // Debug logging to see what body parts were found
        console.log('Human body parts detected:', {
            torso: !!torso,
            head: !!head,
            leftUpperArm: !!leftUpperArm,
            rightUpperArm: !!rightUpperArm,
            leftLowerArm: !!leftLowerArm,
            rightLowerArm: !!rightLowerArm,
            leftUpperLeg: !!leftUpperLeg,
            rightUpperLeg: !!rightUpperLeg,
            leftLowerLeg: !!leftLowerLeg,
            rightLowerLeg: !!rightLowerLeg,
            leftFoot: !!leftFoot,
            rightFoot: !!rightFoot
        });
    }

    // Animation state management with transitions
    function changeState(newState) {
        if (animationState !== newState) {
            animationState = newState;
            stateTimer = 0;
            transitionTimer = 0;
            isTransitioning = true;
        }
    }

    // Store the animation function to be called from main loop
    humanGroup.userData = humanGroup.userData || {};
    humanGroup.userData.animate = (delta) => {
        walkTime += delta;
        stateTimer += delta;
        transitionTimer += delta;

        // Random state changes based on environment and time
        if (Math.random() < 0.002 && stateTimer > 2) {
            const states = ['walking', 'idle', 'turning'];
            const newState = states[Math.floor(Math.random() * states.length)];
            changeState(newState);
        }

        // Movement and direction - actually move the human
        if (animationState === 'walking' || animationState === 'running') {
            // Random direction changes while moving
            if (Math.random() < 0.005) {
                direction = Math.random() * Math.PI * 2;
            }

            const speed = animationState === 'running' ? humanMoveSpeed * 2 : humanMoveSpeed;
            const moveX = Math.cos(direction) * speed * delta;
            const moveZ = Math.sin(direction) * speed * delta;

            const newX = humanGroup.position.x + moveX;
            const newZ = humanGroup.position.z + moveZ;

            // Boundary check
            if (Math.abs(newX) > 85 || Math.abs(newZ) > 85) {
                direction = Math.random() * Math.PI * 2;
            } else {
                humanGroup.position.x = newX;
                humanGroup.position.z = newZ;
            }

            // Update obstacle position for collision detection
            const obstacleIndex = obstacles.findIndex(obs => Math.abs(obs.x - humanGroup.position.x) < 0.1 && Math.abs(obs.z - humanGroup.position.z) < 0.1);
            if (obstacleIndex !== -1) {
                obstacles[obstacleIndex].x = newX;
                obstacles[obstacleIndex].z = newZ;
            }

            // Occasionally run instead of walk
            if (Math.random() < 0.003 && stateTimer > 3) {
                changeState('running');
            }
        } else if (animationState === 'turning') {
            // Smooth turning animation
            const turnSpeed = 0.05;
            direction += turnSpeed;
            
            if (stateTimer > 2) {
                changeState('walking');
            }
        } else if (animationState === 'idle') {
            // Stay in place but animate
            if (stateTimer > 4) {
                changeState('walking');
            }
        }

        humanGroup.rotation.y = direction;

        // Animation intensity based on state
        const amplitude = animationState === 'running' ? runAmplitude : walkAmplitude;
        const speed = animationState === 'running' ? runSpeed : walkSpeed;

        // Performance optimization: Only apply complex animations when character is moving
        const isMoving = (animationState === 'walking' || animationState === 'running');
        const distanceToCamera = Math.hypot(
            humanGroup.position.x - camera.position.x,
            humanGroup.position.z - camera.position.z
        );
        
        // Reduce animation quality when far from camera for performance
        const detailLevel = distanceToCamera > 20 ? 'low' : (distanceToCamera > 10 ? 'medium' : 'high');
        const frameSkip = distanceToCamera > 30 ? 2 : 1; // Skip frames for distant characters
        
        // Performance: cache sin calculations that are used multiple times
        const currentTime = walkTime * (isMoving ? speed : 1);
        const sinTime = Math.sin(currentTime);
        const sinTime2 = Math.sin(currentTime * 2);

        // Enhanced limb animation with realistic phases and performance optimizations
        if (animationState === 'walking' || animationState === 'running') {
            // Body bobbing with realistic pace
            const bodyBob = Math.sin(walkTime * speed) * amplitude * 0.6;
            humanGroup.position.y = bodyBob;

            // Advanced arm animation with shoulder and elbow movement
            const armSwing = Math.sin(walkTime * speed) * (animationState === 'running' ? 0.6 : 0.35);
            const armHeight = animationState === 'running' ? 0.1 : 0.05;
            
            // Left arm (opposite to left leg)
            if (leftUpperArm) {
                leftUpperArm.rotation.x = -armSwing; // Forward/backward swing
                leftUpperArm.rotation.z = Math.sin(walkTime * speed * 0.5) * 0.1; // Subtle rotation
                leftUpperArm.position.y = 0.6 + armHeight * Math.abs(Math.sin(walkTime * speed));
            }
            if (rightUpperArm) {
                rightUpperArm.rotation.x = armSwing;
                rightUpperArm.rotation.z = -Math.sin(walkTime * speed * 0.5) * 0.1;
                rightUpperArm.position.y = 0.6 + armHeight * Math.abs(Math.sin(walkTime * speed));
            }
            
            // Lower arms with elbow bending
            if (leftLowerArm) {
                leftLowerArm.rotation.x = -armSwing * 0.7; // Reduced swing for lower arm
                leftLowerArm.rotation.z = Math.sin(walkTime * speed * 0.3) * 0.05;
            }
            if (rightLowerArm) {
                rightLowerArm.rotation.x = armSwing * 0.7;
                rightLowerArm.rotation.z = -Math.sin(walkTime * speed * 0.3) * 0.05;
            }

            // Advanced leg animation with realistic knee movement
            const legSwing = Math.sin(walkTime * speed) * (animationState === 'running' ? 0.5 : 0.3);
            const kneeBend = Math.max(0, Math.sin(walkTime * speed + Math.PI/2)) * (animationState === 'running' ? 0.4 : 0.25);
            
            // Left leg
            if (leftUpperLeg) {
                leftUpperLeg.rotation.x = legSwing; // Forward/backward swing
                leftUpperLeg.rotation.z = Math.sin(walkTime * speed * 0.4) * 0.02; // Minimal sideways movement
            }
            if (leftLowerLeg) {
                leftLowerLeg.rotation.x = -kneeBend; // Knee bends when leg swings forward
                leftLowerLeg.rotation.z = Math.sin(walkTime * speed * 0.3) * 0.01;
            }
            
            // Right leg (opposite phase)
            if (rightUpperLeg) {
                rightUpperLeg.rotation.x = -legSwing;
                rightUpperLeg.rotation.z = -Math.sin(walkTime * speed * 0.4) * 0.02;
            }
            if (rightLowerLeg) {
                rightLowerLeg.rotation.x = kneeBend;
                rightLowerLeg.rotation.z = -Math.sin(walkTime * speed * 0.3) * 0.01;
            }

            // Realistic foot movement with heel-toe action
            const footSwing = Math.sin(walkTime * speed) * (animationState === 'running' ? 0.2 : 0.12);
            const footLift = Math.max(0, Math.sin(walkTime * speed)) * (animationState === 'running' ? 0.15 : 0.08);
            
            if (leftFoot) {
                leftFoot.rotation.x = footSwing;
                leftFoot.position.y = -1.25 + footLift;
            }
            if (rightFoot) {
                rightFoot.rotation.x = -footSwing;
                rightFoot.position.y = -1.25 + (animationState === 'running' ? 0 : Math.max(0, Math.sin(walkTime * speed + Math.PI)) * 0.08);
            }

            // Enhanced head movement
            if (head) {
                // Slight forward/backward bob
                head.position.y = 1.12 + Math.sin(walkTime * speed * 2) * 0.003;
                // Subtle side-to-side movement
                head.rotation.z = Math.sin(walkTime * speed * 0.8) * 0.02;
                // Look direction based on movement
                head.rotation.y = Math.sin(walkTime * speed * 0.5) * 0.05;
            }

            // Torso movement for natural walking
            if (torso) {
                torso.rotation.z = Math.sin(walkTime * speed * 0.8) * 0.02; // Subtle lean
                torso.rotation.x = Math.sin(walkTime * speed * 0.3) * 0.01; // Very subtle forward lean
            }

        } else if (animationState === 'idle') {
            // Enhanced idle animation - breathing and natural movement
            const breathe = Math.sin(walkTime * 0.8) * 0.008;
            humanGroup.position.y = breathe;

            // Subtle arm movement - arms slightly away from body
            const armIdle = Math.sin(walkTime * 0.4) * 0.08;
            if (leftUpperArm) leftUpperArm.rotation.x = 0.1 + armIdle * 0.3;
            if (rightUpperArm) rightUpperArm.rotation.x = 0.1 - armIdle * 0.3;
            if (leftLowerArm) leftLowerArm.rotation.x = -0.1;
            if (rightLowerArm) rightLowerArm.rotation.x = -0.1;

            // Weight shifting between legs
            const weightShift = Math.sin(walkTime * 0.6) * 0.03;
            if (leftUpperLeg) leftUpperLeg.rotation.x = weightShift;
            if (rightUpperLeg) rightUpperLeg.rotation.x = -weightShift;
            if (leftLowerLeg) leftLowerLeg.rotation.x = -weightShift * 0.5;
            if (rightLowerLeg) rightLowerLeg.rotation.x = weightShift * 0.5;

            // Head looking around
            if (head) {
                head.rotation.y = Math.sin(walkTime * 0.5) * 0.3;
                head.position.y = 1.12 + Math.sin(walkTime * 0.4) * 0.002;
            }

            // Subtle torso movement
            if (torso) {
                torso.rotation.y = Math.sin(walkTime * 0.3) * 0.02;
            }

        } else if (animationState === 'turning') {
            // Turning animation - look around while turning
            if (head) {
                head.rotation.y = Math.sin(stateTimer * 2) * 0.5; // Look around while turning
                head.position.y = 1.12 + Math.sin(walkTime * 1.2) * 0.005;
            }

            // Slight arm movement during turn
            const turnArm = Math.sin(stateTimer * 4) * 0.1;
            if (leftUpperArm) leftUpperArm.rotation.x = turnArm;
            if (rightUpperArm) rightUpperArm.rotation.x = -turnArm;

            // Feet positioned for turning
            if (leftFoot) leftFoot.rotation.x = Math.sin(stateTimer * 2) * 0.1;
            if (rightFoot) rightFoot.rotation.x = -Math.sin(stateTimer * 2) * 0.1;
        }

        // End transition after a short time
        if (isTransitioning && transitionTimer > 0.3) {
            isTransitioning = false;
        }
    };
}

// Spawn humans randomly across the world like ducks, but ensure they're not too close to player or houses
for (let i = 0; i < 7; i++) {
    let x, z;
    let attempts = 0;
    const maxAttempts = 50;

    do {
        // Random position within a large area (similar to ducks)
        x = (Math.random() - 0.5) * 150; // Wider area than ducks (150 vs 120)
        z = (Math.random() - 0.5) * 150;

        // Check distance from player (must be at least 40 units away)
        const distanceToPlayer = Math.hypot(x - 0, z - 0);

        // Check distance from houses (must be at least 30 units away from any house)
        const housePositions = [
            { x: -30, z: 30 },   // House 1
            { x: 35, z: 25 },    // House 2
            { x: -20, z: -40 },  // House 3
            { x: 40, z: -35 }    // House 4
        ];

        let tooCloseToHouse = false;
        for (const house of housePositions) {
            const distanceToHouse = Math.hypot(x - house.x, z - house.z);
            if (distanceToHouse < 30) {
                tooCloseToHouse = true;
                break;
            }
        }

        attempts++;

        // Keep trying until we find a good position or give up
        if (distanceToPlayer >= 40 && !tooCloseToHouse) {
            break;
        }

    } while (attempts < maxAttempts);

    // If we couldn't find a good position after many attempts, place at a safe edge location
    if (attempts >= maxAttempts) {
        const angle = Math.random() * Math.PI * 2;
        const safeDistance = 80 + Math.random() * 20;
        x = Math.cos(angle) * safeDistance;
        z = Math.sin(angle) * safeDistance;
        console.log(`Human ${i+1} placed at fallback position (${x.toFixed(1)}, ${z.toFixed(1)})`);
    } else {
        console.log(`Human ${i+1} spawned at (${x.toFixed(1)}, ${z.toFixed(1)}), distance from player: ${Math.hypot(x, z).toFixed(1)}`);
    }

    createAnimatedHuman(x, z);
}

// Add 5 cars using the old_rusty_car.glb model near houses (much further away from houses)
const carPositions = [
    { x: -45, z: 55 }, // Near house 1
    { x: 60, z: 50 },  // Near house 2
    { x: -35, z: -55 }, // Near house 3
    { x: 65, z: -50 },  // Near house 4
    { x: 15, z: 70 }   // Near center area
];

// Add car models at the marked positions
carPositions.forEach((pos, index) => {
    loadGLTFModel('assets/models/downloads/cars/old_rusty_car.glb', (gltf) => {
        console.log(`Car ${index + 1} loaded successfully`);
        const car = gltf.scene;
        const scale = 0.008 + Math.random() * 0.004; // Final smaller realistic car size
        car.scale.set(scale, scale, scale);
        car.position.set(pos.x, 0, pos.z);

        // Random rotation for variety
        car.rotation.y = Math.random() * Math.PI * 2;

        car.traverse(function (object) {
            if (object.isMesh) {
                console.log(`Processing car ${index + 1} mesh:`, object.name);
                object.castShadow = true;
                object.receiveShadow = true;
                // Apply realistic car materials
                if (object.material) {
                    if (object.material.map) {
                        object.material.map.colorSpace = THREE.SRGBColorSpace;
                    }
                    object.material.roughness = 0.8;
                    object.material.metalness = 0.3;
                    object.material.needsUpdate = true;
                }
            }
        });

        scene.add(car);
        console.log(`Car ${index + 1} added to scene at (${pos.x}, ${pos.z})`);

        // Add car to obstacles for collision (medium radius)
        obstacles.push({ x: pos.x, z: pos.z, radius: 4 });
    }, (error) => {
        console.warn(`Failed to load car model ${index + 1}:`, error);
    });
});

// Ducks removed as requested

// GLTF Loader for 3D models

// Debug function for GLTF loading
function loadGLTFModel(path, onLoad, onError) {
    console.log('Attempting to load GLTF model from:', path);
    gltfLoader.load(
        path,
        (gltf) => {
            console.log('GLTF model loaded successfully:', path);
            onLoad(gltf);
        },
        (progress) => {
            console.log('GLTF loading progress:', progress);
        },
        (error) => {
            console.error('Error loading GLTF model:', path, error);
            if (onError) onError(error);
        }
    );
}

// Keyframe Animation Utilities (based on Three.js webgl_animation_keyframes example)
function createKeyframeAnimation(object, duration = 2, loop = true) {
    // Create position keyframes for a simple bounce animation
    const positionKF = new THREE.VectorKeyframeTrack(
        '.position',
        [0, 0.5, 1, 1.5, 2],
        [
            object.position.x, object.position.y, object.position.z,
            object.position.x, object.position.y + 2, object.position.z,
            object.position.x, object.position.y, object.position.z,
            object.position.x, object.position.y + 1, object.position.z,
            object.position.x, object.position.y, object.position.z
        ]
    );

    // Create rotation keyframes
    const rotationKF = new THREE.QuaternionKeyframeTrack(
        '.quaternion',
        [0, 1, 2],
        [
            0, 0, 0, 1,
            0, 0, Math.PI * 0.5, 1,
            0, 0, Math.PI, 1
        ]
    );

    // Create scale keyframes
    const scaleKF = new THREE.VectorKeyframeTrack(
        '.scale',
        [0, 0.5, 1, 1.5, 2],
        [
            1, 1, 1,
            1.2, 0.8, 1.2,
            1, 1, 1,
            0.8, 1.2, 0.8,
            1, 1, 1
        ]
    );

    // Create animation clip
    const clip = new THREE.AnimationClip('bounce', duration, [positionKF, rotationKF, scaleKF]);

    // Create animation mixer if not exists
    if (!object.userData.mixer) {
        object.userData.mixer = new THREE.AnimationMixer(object);
        mixers.push(object.userData.mixer);
    }

    // Create animation action
    const action = object.userData.mixer.clipAction(clip);
    if (loop) {
        action.loop = THREE.LoopRepeat;
    }

    return action;
}

function playKeyframeAnimation(object, animationName = 'bounce') {
    if (object.userData.mixer) {
        const action = object.userData.mixer.existingAction(animationName);
        if (action) {
            action.play();
        }
    }
}

function stopKeyframeAnimation(object, animationName = 'bounce') {
    if (object.userData.mixer) {
        const action = object.userData.mixer.existingAction(animationName);
        if (action) {
            action.stop();
        }
    }
}

// Custom keyframe animation for collectibles (fruits)
function createCollectibleAnimation(fruit) {
    const action = createKeyframeAnimation(fruit, 3, true);
    action.name = 'bounce';
    return action;
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

    // Add keyframe animation to the fruit
    createCollectibleAnimation(fruit);
    playKeyframeAnimation(fruit, 'bounce');
}

// Crops for harvesting
const crops = [];

function createCrop(x, z) {
    const cropGroup = new THREE.Group();

    // Stem (blocky)
    const stemGeo = new THREE.BoxGeometry(0.1, 1, 0.1);
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.set(0, 0.5, 0);
    stem.castShadow = true;
    cropGroup.add(stem);

    // Crop top (cube for Minecraft style)
    const cropGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
    const cropMat = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
    const crop = new THREE.Mesh(cropGeo, cropMat);
    crop.position.set(0, 1.2, 0);
    crop.castShadow = true;
    cropGroup.add(crop);

    cropGroup.position.set(x, 0, z);
    scene.add(cropGroup);
    crops.push({ group: cropGroup, x, z, harvested: false });
}

// Bushes removed as requested - they had no textures and looked poor

// Add fruits with keyframe animations
for (let i = 0; i < 5; i++) {
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
function playFootstepSound() { createBeep(150 + Math.random() * 50, 0.08, 0.03); }
function playWaterSound() { createBeep(300 + Math.random() * 100, 0.15, 0.04); }

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

    // Third-person camera system - character positioned in front of camera
    if (playerCharacter) {
        // Position character 4 units in front of camera for better third-person view
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        direction.y = 0;
        direction.normalize();

        const characterPos = camera.position.clone().add(direction.multiplyScalar(2.5)); // Closer to camera
        playerCharacter.position.set(characterPos.x, 0, characterPos.z);

        // Character faces the direction of movement with smooth rotation
        // Calculate movement direction based on input
        const moveVector = new THREE.Vector3();
        if (moveState.forward) moveVector.z -= 1;
        if (moveState.backward) moveVector.z += 1;
        if (moveState.left) moveVector.x -= 1;
        if (moveState.right) moveVector.x += 1;

        if (moveVector.lengthSq() > 0) {
            moveVector.normalize();
            // Transform movement vector by camera rotation
            moveVector.applyQuaternion(camera.quaternion);
            moveVector.y = 0;
            moveVector.normalize();

            // Calculate target rotation
            const targetRotation = Math.atan2(moveVector.x, moveVector.z);

            // Smooth rotation interpolation
            const currentRotation = playerCharacter.rotation.y;
            const rotationDiff = targetRotation - currentRotation;

            // Handle angle wrapping
            let shortestAngle = rotationDiff;
            if (rotationDiff > Math.PI) shortestAngle -= 2 * Math.PI;
            if (rotationDiff < -Math.PI) shortestAngle += 2 * Math.PI;

            // Smooth lerp rotation
            playerCharacter.rotation.y = currentRotation + shortestAngle * 0.1;
        } else {
            // When not moving, smoothly face the camera direction
            const targetRotation = camera.rotation.y;
            const currentRotation = playerCharacter.rotation.y;
            const rotationDiff = targetRotation - currentRotation;

            let shortestAngle = rotationDiff;
            if (rotationDiff > Math.PI) shortestAngle -= 2 * Math.PI;
            if (rotationDiff < -Math.PI) shortestAngle += 2 * Math.PI;

            playerCharacter.rotation.y = currentRotation + shortestAngle * 0.05;
        }
    } else {
        // Fallback for when model isn't loaded yet
        const playerGroup = scene.children.find(child => child.type === 'Group' && child.children.length > 0);
        if (playerGroup) {
            playerGroup.position.set(camera.position.x, 0, camera.position.z);
            playerGroup.rotation.y = camera.rotation.y;
        }
    }

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

    // Play footstep sounds occasionally when moving
    if ((moveState.forward || moveState.backward || moveState.left || moveState.right) && Math.random() < 0.02) {
        playFootstepSound();
    }

    // Play ambient sounds occasionally
    if (Math.random() < 0.005) {
        playAmbientSound();
    }

    // Water sounds removed


    // Update ocean model animation if it exists
    // (Water animation is handled by the GLTF model's built-in animation mixer)


    // Animate house doors
    for (const h of houses) {
        const dist = Math.hypot(camera.position.x - h.x, camera.position.z - h.z);
        if (h.group && h.group.userData.door) {
            const door = h.group.userData.door;
            const targetRotation = dist < 3 ? -Math.PI / 2 : 0;
            door.rotation.y = THREE.MathUtils.lerp(door.rotation.y, targetRotation, 0.1);
        }
    }



    // Update weather
    updateWeather(delta);

    // Add subtle camera shake when moving for immersion
    if (moveState.forward || moveState.backward || moveState.left || moveState.right) {
        const shakeAmount = 0.02;
        camera.position.x += (Math.random() - 0.5) * shakeAmount;
        camera.position.y += (Math.random() - 0.5) * shakeAmount * 0.5;
        camera.position.z += (Math.random() - 0.5) * shakeAmount;
    }

    // Performance-optimized animation update
    // Skip animation updates for very distant characters to improve performance
    const maxVisibleDistance = 200; // Increased distance for NPCs to move even when far
    const frameSkipDistance = 100;
    let frameCounter = 0;

    for (const character of animatedHumans) {
        if (character.userData && character.userData.animate) {
            const distanceToCamera = Math.hypot(
                character.position.x - camera.position.x,
                character.position.z - camera.position.z
            );

            // Skip animation updates for very distant characters
            if (distanceToCamera > maxVisibleDistance) continue;

            // Frame skipping for medium-distant characters
            if (distanceToCamera > frameSkipDistance && frameCounter % 2 === 0) continue;

            character.userData.animate(delta);
        }
    }
    frameCounter++;

    for (const mixer of mixers) {
        mixer.update(delta);
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

// Run an an initial automatic tuning pass
autoTuneVisuals();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Create minimap/compass system
function createMinimap() {
    const minimapContainer = document.createElement('div');
    minimapContainer.id = 'minimap-container';
    minimapContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 200px;
        height: 200px;
        background: rgba(0, 0, 0, 0.7);
        border: 2px solid #fff;
        border-radius: 10px;
        z-index: 1000;
        overflow: hidden;
    `;

    const minimapCanvas = document.createElement('canvas');
    minimapCanvas.id = 'minimap-canvas';
    minimapCanvas.width = 200;
    minimapCanvas.height = 200;
    minimapCanvas.style.cssText = `
        width: 100%;
        height: 100%;
        display: block;
    `;

    minimapContainer.appendChild(minimapCanvas);
    document.body.appendChild(minimapContainer);

    const ctx = minimapCanvas.getContext('2d');
    const mapSize = 200; // World units to display
    const scale = minimapCanvas.width / (mapSize * 2); // Scale factor

    function updateMinimap() {
        ctx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

        // Draw map background
        ctx.fillStyle = '#2d5a27';
        ctx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);

        // Draw grid
        ctx.strokeStyle = '#4a7c42';
        ctx.lineWidth = 1;
        for (let i = 0; i <= minimapCanvas.width; i += 20) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, minimapCanvas.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(minimapCanvas.width, i);
            ctx.stroke();
        }

        // Center point (0, 0)
        const centerX = minimapCanvas.width / 2;
        const centerY = minimapCanvas.height / 2;

        // Draw player position (camera position)
        const playerX = centerX + (camera.position.x * scale);
        const playerY = centerY + (camera.position.z * scale);

        // Keep player dot within bounds
        const clampedPlayerX = Math.max(5, Math.min(minimapCanvas.width - 5, playerX));
        const clampedPlayerY = Math.max(5, Math.min(minimapCanvas.height - 5, playerY));

        // Player triangle (pointing in movement direction)
        ctx.fillStyle = '#ff0000';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;

        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        const angle = Math.atan2(direction.x, direction.z);

        ctx.save();
        ctx.translate(clampedPlayerX, clampedPlayerY);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(-4, 4);
        ctx.lineTo(4, 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Draw houses
        houses.forEach(house => {
            const houseX = centerX + (house.x * scale);
            const houseY = centerY + (house.z * scale);

            if (houseX >= 0 && houseX <= minimapCanvas.width && houseY >= 0 && houseY <= minimapCanvas.height) {
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(houseX - 3, houseY - 3, 6, 6);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.strokeRect(houseX - 3, houseY - 3, 6, 6);
            }
        });

        // Pond removed from minimap

        // Draw trees
        trunkMeshes.forEach(tree => {
            if (tree && tree.position) {
                const treeX = centerX + (tree.position.x * scale);
                const treeY = centerY + (tree.position.z * scale);

                if (treeX >= 0 && treeX <= minimapCanvas.width && treeY >= 0 && treeY <= minimapCanvas.height) {
                    ctx.fillStyle = '#228B22';
                    ctx.beginPath();
                    ctx.arc(treeX, treeY, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        });

        // Draw humans
        animatedHumans.forEach(human => {
            if (human && human.position) {
                const humanX = centerX + (human.position.x * scale);
                const humanY = centerY + (human.position.z * scale);

                if (humanX >= 0 && humanX <= minimapCanvas.width && humanY >= 0 && humanY <= minimapCanvas.height) {
                    ctx.fillStyle = '#4169E1';
                    ctx.beginPath();
                    ctx.arc(humanX, humanY, 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        });

        // Stones removed from minimap

        // Draw Soviet buildings
        sovietBuildingPositions.forEach(building => {
            const buildingX = centerX + (building.x * scale);
            const buildingY = centerY + (building.z * scale);

            if (buildingX >= 0 && buildingX <= minimapCanvas.width && buildingY >= 0 && buildingY <= minimapCanvas.height) {
                ctx.fillStyle = '#696969';
                ctx.fillRect(buildingX - 4, buildingY - 4, 8, 8);
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1;
                ctx.strokeRect(buildingX - 4, buildingY - 4, 8, 8);
            }
        });

        // Draw compass rose
        const compassSize = 30;
        const compassX = minimapCanvas.width - compassSize - 10;
        const compassY = minimapCanvas.height - compassSize - 10;

        // Compass background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.beginPath();
        ctx.arc(compassX + compassSize/2, compassY + compassSize/2, compassSize/2, 0, Math.PI * 2);
        ctx.fill();

        // Compass directions
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;

        // N
        ctx.beginPath();
        ctx.moveTo(compassX + compassSize/2, compassY + 5);
        ctx.lineTo(compassX + compassSize/2, compassY + compassSize - 5);
        ctx.stroke();

        // S
        ctx.beginPath();
        ctx.moveTo(compassX + compassSize/2, compassY + compassSize - 5);
        ctx.lineTo(compassX + compassSize/2, compassY + 5);
        ctx.stroke();

        // E
        ctx.beginPath();
        ctx.moveTo(compassX + 5, compassY + compassSize/2);
        ctx.lineTo(compassX + compassSize - 5, compassY + compassSize/2);
        ctx.stroke();

        // W
        ctx.beginPath();
        ctx.moveTo(compassX + compassSize - 5, compassY + compassSize/2);
        ctx.lineTo(compassX + 5, compassY + compassSize/2);
        ctx.stroke();

        // Direction labels
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('N', compassX + compassSize/2, compassY + 15);
        ctx.fillText('S', compassX + compassSize/2, compassY + compassSize - 8);
        ctx.fillText('E', compassX + compassSize - 8, compassY + compassSize/2 + 3);
        ctx.fillText('W', compassX + 8, compassY + compassSize/2 + 3);
    }

    // Update minimap every frame
    function animateMinimap() {
        updateMinimap();
        requestAnimationFrame(animateMinimap);
    }
    animateMinimap();

    return minimapContainer;
}

// Create minimap when game starts
const minimapStartButton = document.getElementById('start-button');
if (minimapStartButton) {
    minimapStartButton.addEventListener('click', () => {
        // Minimap is created when pointer lock starts
        setTimeout(() => {
            createMinimap();
        }, 100);
    });
}

// Expose a runtime handle for the game
window.__GAME = {
    scene,
    camera,
    renderer,
    trunkMeshes,
    rockMeshes,
    leafMeshes,
    wallMaterials,
    animatedHumans,
    createTree,
    createRock,
    createHouse,
    createBush,
    createFruit,
    createCrop,
    collectibles,
    houses,
    obstacles,
    crops,
    ground,
    loader,
    tryLoadTexture,
};

// Also export named symbols for environments that prefer module imports
// Note: Export commented out to avoid module import issues in browser"}" 












