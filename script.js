import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/postprocessing/UnrealBloomPass.js';
import { runBFS, runDFS, runAStar, isObstacle } from './algorithms.js';

// --- CONFIG ---
export const GRID_SIZE = 10;
export const CELL_SIZE = 2.0; // Super Zoom
export const TERRAIN_TYPES = {
    grass:  { cost: 1,  color: 0x312e81, emissive: 0x1e1b4b, metalness: 0.1, roughness: 0.9 },
    forest: { cost: 3,  color: 0x064e3b, emissive: 0x022c22, hasTrees: true, metalness: 0.2, roughness: 1.0 },
    water:  { cost: 10, color: 0x1e40af, emissive: 0x1d4ed8, opacity: 0.8, metalness: 0.8, roughness: 0.2 },
    wall:   { cost: Infinity, color: 0xef4444, emissive: 0x991b1b, hasRocks: true, metalness: 0.6, roughness: 0.4 }
};

// --- GLOBALS ---
export let scene, camera, renderer, controls, raycaster, mouse, composer;
export let grid = [];
export let startNode = { r: 8, c: 8 }; // Adjusted for 10x10
export let endNode = { r: 1, c: 1 };   // Adjusted for 10x10
export let isRunning = false;
export let currentSearchId = 0; // Track current search to abort old ones
let currentBrush = 'wall';
let character, knight;
export let pathLine = null;
let particles = [];
let embers = []; // Atmospheric embers
let clock = new THREE.Clock();

// Audio System
let audioCtx = null;
export function playSound(freq, type = 'sine', duration = 0.1, volume = 0.1) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
}

// DOM Elements
export const startBtn = document.getElementById('start-btn');
const mazeBtn = document.getElementById('maze-btn');
const resetBtn = document.getElementById('reset-btn');
export const algorithmSelect = document.getElementById('algorithm');
export const pathCostDisplay = document.getElementById('path-cost');
export const pathLengthDisplay = document.getElementById('path-length');
export const nodesVisitedDisplay = document.getElementById('nodes-visited');
const brushBtns = document.querySelectorAll('.brush-btn');

// --- INIT ---
function init() {
    // Scene Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617); 
    scene.fog = new THREE.Fog(0x020617, 20, 80);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(10, 10, 10);

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ReinhardToneMapping;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.1;

    // Lighting Overhaul (High Contrast Horror)
    const ambientLight = new THREE.AmbientLight(0x4c1d95, 0.6); // Indigo ambient
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xef4444, 1.5); // Blood red moon
    sunLight.position.set(10, 30, 15);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    const rimLight = new THREE.PointLight(0x9333ea, 1, 50);
    rimLight.position.set(-10, 10, -10);
    scene.add(rimLight);

    // Post Processing
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.1;
    bloomPass.strength = 1.0;
    
    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Interaction
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    createGrid();
    createWizard();
    createKnight();
    createEmbers();
    animate();

    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousedown', onMouseDown);
    mazeBtn.addEventListener('click', generateRandomMaze);

    // Modal Listeners
    const modal = document.getElementById('comparison-modal');
    const showBtn = document.getElementById('show-comparison');
    const closeBtn = document.getElementsByClassName('close-modal')[0];

    showBtn.onclick = () => { modal.style.display = 'block'; playSound(660, 'triangle', 0.1); };
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => { if (e.target == modal) modal.style.display = 'none'; };
}

function createEmbers() {
    for(let i=0; i<30; i++) {
        const geo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0xff4500, 
            emissive: 0xff4500, 
            emissiveIntensity: 10,
            transparent: true,
            opacity: 0.6
        });
        const ember = new THREE.Mesh(geo, mat);
        resetEmber(ember);
        scene.add(ember);
        embers.push(ember);
    }
}

function resetEmber(ember) {
    const range = 15;
    ember.position.set(
        (Math.random() - 0.5) * range,
        Math.random() * 5 + 2,
        (Math.random() - 0.5) * range
    );
    ember.userData.speed = Math.random() * 0.02 + 0.01;
}

function createGrid() {
    const offset = (GRID_SIZE * CELL_SIZE) / 2;

    for (let r = 0; r < GRID_SIZE; r++) {
        grid[r] = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            const type = 'grass';
            const info = TERRAIN_TYPES[type];
            
            const geometry = new THREE.BoxGeometry(CELL_SIZE - 0.05, 0.15, CELL_SIZE - 0.05);
            const material = new THREE.MeshStandardMaterial({ 
                color: info.color,
                transparent: !!info.opacity,
                opacity: info.opacity || 1,
                metalness: info.metalness,
                roughness: info.roughness
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            // Consistent Mapping: X = r, Z = c (Including CELL_SIZE)
            mesh.position.set(r * CELL_SIZE - offset + CELL_SIZE/2, 0, c * CELL_SIZE - offset + CELL_SIZE/2);
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            mesh.userData = { r, c }; // Only store r, c to avoid stale type data
            scene.add(mesh);

            grid[r][c] = {
                r, c,
                type,
                mesh,
                isVisited: false,
                parent: null,
                g: Infinity,
                f: Infinity,
                decorations: []
            };
        }
    }
}

function createWizard() {
    const wizardGroup = new THREE.Group();
    
    // Cloak (Necromancer style)
    const bodyGeo = new THREE.CylinderGeometry(0, 0.35, 0.8, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4;
    body.castShadow = true;
    wizardGroup.add(body);

    // Dark Beard
    const beardGeo = new THREE.ConeGeometry(0.12, 0.3, 8);
    const beardMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
    const beard = new THREE.Mesh(beardGeo, beardMat);
    beard.position.set(0, 0.65, 0.1);
    wizardGroup.add(beard);

    // Head
    const headGeo = new THREE.SphereGeometry(0.15, 12, 12);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.8;
    wizardGroup.add(head);

    // Necromancer Hat
    const hatBaseGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12);
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x020617 });
    const hatBase = new THREE.Mesh(hatBaseGeo, hatMat);
    hatBase.position.y = 0.92;
    wizardGroup.add(hatBase);

    const hatTopGeo = new THREE.ConeGeometry(0.18, 0.6, 12);
    const hatTop = new THREE.Mesh(hatTopGeo, hatMat);
    hatTop.position.set(0, 1.2, -0.1);
    hatTop.rotation.x = -0.3;
    wizardGroup.add(hatTop);

    // Scythe Staff
    const staffGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6);
    const staffMat = new THREE.MeshStandardMaterial({ color: 0x1e293b });
    const staff = new THREE.Mesh(staffGeo, staffMat);
    staff.position.set(0.3, 0.7, 0);
    staff.rotation.z = -0.1;
    wizardGroup.add(staff);

    // Ethereal Skull Gem
    const gemGeo = new THREE.IcosahedronGeometry(0.1, 0);
    const gemMat = new THREE.MeshStandardMaterial({ 
        color: 0x4ade80, 
        emissive: 0x4ade80, 
        emissiveIntensity: 10 
    });
    const gem = new THREE.Mesh(gemGeo, gemMat);
    gem.position.set(0.35, 1.4, 0);
    wizardGroup.add(gem);

    const gemLight = new THREE.PointLight(0x4ade80, 3, 5);
    gemLight.position.copy(gem.position);
    wizardGroup.add(gemLight);

    character = wizardGroup;
    scene.add(character);
    character.scale.setScalar(1.5); // Super Large
    updateWizardPos();
}

export function updateWizardPos() {
    const offset = (GRID_SIZE * CELL_SIZE) / 2;
    character.position.set(endNode.r * CELL_SIZE - offset + CELL_SIZE/2, 0, endNode.c * CELL_SIZE - offset + CELL_SIZE/2);
}

function createKnight() {
    const knightGroup = new THREE.Group();
    
    // Cursed Armor
    const bodyGeo = new THREE.BoxGeometry(0.45, 0.6, 0.35);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x020617, metalness: 0.8, roughness: 0.5 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.4;
    body.castShadow = true;
    knightGroup.add(body);

    // Skeleton Helm
    const helmGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const helmMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9 });
    const helm = new THREE.Mesh(helmGeo, helmMat);
    helm.position.y = 0.8;
    knightGroup.add(helm);

    // Glowing Red Eyes
    const eyeGeo = new THREE.SphereGeometry(0.03, 4, 4);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 10 });
    
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.08, 0.85, 0.15);
    knightGroup.add(eyeL);

    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeR.position.set(0.08, 0.85, 0.15);
    knightGroup.add(eyeR);

    // Broken Shield
    const shieldGeo = new THREE.BoxGeometry(0.4, 0.5, 0.05);
    const shieldMat = new THREE.MeshStandardMaterial({ color: 0x450a0a });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.set(0.3, 0.4, 0.1);
    shield.rotation.y = -0.5;
    knightGroup.add(shield);

    // Pentagram Beacon (Glowing Ring)
    const ringGeo = new THREE.TorusGeometry(0.6, 0.03, 16, 32);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0xef4444, emissiveIntensity: 5, transparent: true, opacity: 0.8 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    knightGroup.add(ring);

    knight = knightGroup;
    scene.add(knight);
    knight.scale.setScalar(1.5); // Super Large
    updateCharacterPos(startNode.r, startNode.c);
}

export function spawnMagicParticles(x, y, z, color, count = 10) {
    for (let i = 0; i < count; i++) {
        const geo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
        const mat = new THREE.MeshStandardMaterial({ 
            color: color, 
            emissive: color, 
            emissiveIntensity: 5,
            transparent: true
        });
        const p = new THREE.Mesh(geo, mat);
        p.position.set(x, y, z);
        
        const vel = new THREE.Vector3(
            (Math.random() - 0.5) * 0.1,
            Math.random() * 0.15,
            (Math.random() - 0.5) * 0.1
        );
        
        particles.push({ mesh: p, velocity: vel, life: 1.0 });
        scene.add(p);
    }
}

export function updateCharacterPos(r, c) {
    const offset = (GRID_SIZE * CELL_SIZE) / 2;
    // Now moving the Knight instead of the Wizard
    knight.position.set(r * CELL_SIZE - offset + CELL_SIZE/2, 0, c * CELL_SIZE - offset + CELL_SIZE/2);
    spawnMagicParticles(knight.position.x, 0.5, knight.position.z, 0xef4444, 4); // Red blood particles for Knight
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseDown(event) {
    if (isRunning) return;
    
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    // Filter only the grid meshes to ignore decorations/particles
    const gridMeshes = grid.flat().map(n => n.mesh);
    const intersects = raycaster.intersectObjects(gridMeshes);

    if (intersects.length > 0) {
        const obj = intersects[0].object;
        const { r, c } = obj.userData;
        
        if (currentBrush === 'start') {
            if (isObstacle(grid[r][c]) || (r === endNode.r && c === endNode.c)) return;
            startNode = { r, c };
            updateCharacterPos(r, c);
            playSound(440, 'triangle', 0.1);
        } else if (currentBrush === 'end') {
            if (isObstacle(grid[r][c]) || (r === startNode.r && c === startNode.c)) return;
            endNode = { r, c };
            updateWizardPos();
            playSound(660, 'triangle', 0.1);
        } else {
            if ((r === startNode.r && c === startNode.c) || (r === endNode.r && c === endNode.c)) return;
            updateCell(r, c, currentBrush);
            playSound(110, 'sine', 0.05);
        }
        clearVisuals();
    }
}

function generateRandomMaze() {
    if (isRunning) return;
    clearVisuals();
    for(let r=0; r<GRID_SIZE; r++) {
        for(let c=0; c<GRID_SIZE; c++) {
            if ((r === startNode.r && c === startNode.c) || (r === endNode.r && c === endNode.c)) continue;
            if (Math.random() < 0.3) updateCell(r, c, 'wall');
            else updateCell(r, c, 'grass');
        }
    }
    playSound(220, 'square', 0.2);
}

export function updateCell(r, c, type) {
    const node = grid[r][c];
    const info = TERRAIN_TYPES[type];
    
    node.decorations.forEach(d => scene.remove(d));
    node.decorations = [];

    node.type = type;
    node.mesh.material.color.set(info.color);
    node.mesh.material.opacity = info.opacity || 1;
    node.mesh.material.transparent = !!info.opacity;
    node.mesh.material.emissive.set(info.emissive || 0x000000);

    if (info.hasTrees) {
        const treeCount = 1 + Math.floor(Math.random() * 2);
        for(let i=0; i<treeCount; i++) {
            const treeGroup = new THREE.Group();
            const trunkGeo = new THREE.CylinderGeometry(0.04, 0.08, 0.6);
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03 }); // Brown trunk
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.y = 0.3;
            treeGroup.add(trunk);

            // Green leaves
            const leaveGeo = new THREE.ConeGeometry(0.25, 0.5, 8);
            const leaveMat = new THREE.MeshStandardMaterial({ color: 0x059669 });
            const leaves = new THREE.Mesh(leaveGeo, leaveMat);
            leaves.position.y = 0.6;
            treeGroup.add(leaves);

            treeGroup.position.set(
                node.mesh.position.x + (Math.random() - 0.5) * 0.4, 
                0, 
                node.mesh.position.z + (Math.random() - 0.5) * 0.4
            );
            scene.add(treeGroup);
            node.decorations.push(treeGroup);
            treeGroup.userData.isTree = true;
        }
        
        // Flying Bird
        const birdGeo = new THREE.SphereGeometry(0.03, 4, 4);
        const birdMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const bird = new THREE.Mesh(birdGeo, birdMat);
        bird.position.set(node.mesh.position.x, 1.2, node.mesh.position.z);
        scene.add(bird);
        node.decorations.push(bird);
        bird.userData.isBird = true;
        bird.userData.offset = Math.random() * 10;
        bird.userData.origX = node.mesh.position.x;
        bird.userData.origZ = node.mesh.position.z;
    }
    
    if (type === 'grass') {
        // Cursed Flowers
        const flowerCount = 2 + Math.floor(Math.random() * 2);
        for(let i=0; i<flowerCount; i++) {
            const flowerGeo = new THREE.SphereGeometry(0.05, 8, 8);
            const flowerMat = new THREE.MeshStandardMaterial({ 
                color: 0x9333ea,
                emissive: 0x9333ea,
                emissiveIntensity: 2
            });
            const flower = new THREE.Mesh(flowerGeo, flowerMat);
            flower.position.set(
                node.mesh.position.x + (Math.random() - 0.5) * 0.7, 
                0.05, 
                node.mesh.position.z + (Math.random() - 0.5) * 0.7
            );
            scene.add(flower);
            node.decorations.push(flower);
            flower.userData.isFlower = true;
            flower.userData.offset = Math.random() * 5;
        }
    }
    
    if (type === 'water') {
        // Water Bubbles
        const bubbleCount = 2;
        for(let i=0; i<bubbleCount; i++) {
            const bubbleGeo = new THREE.SphereGeometry(0.04, 8, 8);
            const bubbleMat = new THREE.MeshStandardMaterial({ 
                color: 0xffffff, 
                emissive: 0x22d3ee, 
                emissiveIntensity: 2,
                transparent: true,
                opacity: 0.6
            });
            const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);
            bubble.position.set(
                node.mesh.position.x + (Math.random() - 0.5) * 0.5, 
                0, 
                node.mesh.position.z + (Math.random() - 0.5) * 0.5
            );
            scene.add(bubble);
            node.decorations.push(bubble);
            bubble.userData.isBubble = true;
            bubble.userData.offset = Math.random() * 10;
        }
    }

    if (info.hasRocks) {
        const rockCount = 3 + Math.floor(Math.random() * 2);
        for(let i=0; i<rockCount; i++) {
            // Dark Jagged Crystal
            const rockGeo = new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.2, 0);
            const rockMat = new THREE.MeshStandardMaterial({ 
                color: 0x020617,
                emissive: 0xef4444,
                emissiveIntensity: 2,
                metalness: 0.9,
                roughness: 0.1
            });
            const rock = new THREE.Mesh(rockGeo, rockMat);
            rock.position.set(
                node.mesh.position.x + (Math.random() - 0.5) * 0.6, 
                0.15, 
                node.mesh.position.z + (Math.random() - 0.5) * 0.6
            );
            rock.rotation.set(Math.random(), Math.random(), Math.random());
            scene.add(rock);
            node.decorations.push(rock);
            
            rock.userData.isCrystal = true;
            rock.userData.offset = Math.random() * Math.PI;
        }
        
        // Cursed Rune (Floating)
        const runeGeo = new THREE.PlaneGeometry(0.4, 0.4);
        const runeMat = new THREE.MeshBasicMaterial({ 
            color: 0xef4444, 
            transparent: true, 
            opacity: 0.7,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        const rune = new THREE.Mesh(runeGeo, runeMat);
        rune.position.set(node.mesh.position.x, 0.8, node.mesh.position.z);
        rune.rotation.x = Math.PI / 2;
        scene.add(rune);
        node.decorations.push(rune);
        rune.userData.isRune = true;

        const emberLight = new THREE.PointLight(0xef4444, 2, 3);
        emberLight.position.set(node.mesh.position.x, 0.5, node.mesh.position.z);
        scene.add(emberLight);
        node.decorations.push(emberLight);
    }
}

export function clearVisuals() {
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const node = grid[r][c];
            if (!node) continue;
            node.isVisited = false;
            node.parent = null;
            node.g = Infinity;
            node.f = Infinity;
            
            const baseColor = TERRAIN_TYPES[node.type].color;
            const baseEmissive = TERRAIN_TYPES[node.type].emissive;
            node.mesh.material.color.set(baseColor);
            node.mesh.material.emissive.set(baseEmissive || 0x000000);
            node.mesh.material.emissiveIntensity = 1;
            node.mesh.material.opacity = TERRAIN_TYPES[node.type].opacity || 1;
        }
    }
    
    if (character) character.visible = true; 
    
    if (pathLine) {
        scene.remove(pathLine);
        pathLine = null;
    }
    pathCostDisplay.innerText = '-';
    pathLengthDisplay.innerText = '-';
    nodesVisitedDisplay.innerText = '-';
    updateCharacterPos(startNode.r, startNode.c);
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function draw3DPath(path) {
    if (pathLine) scene.remove(pathLine);
    const points = path.map(node => new THREE.Vector3(node.mesh.position.x, 0.3, node.mesh.position.z));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xffa500, linewidth: 5 });
    pathLine = new THREE.Line(geometry, material);
    scene.add(pathLine);
    
    pathCostDisplay.innerText = path[path.length-1].g === Infinity ? '-' : path[path.length-1].g;
    pathLengthDisplay.innerText = path.length;
}

async function animateCharacter(path, searchId) {
    for (let node of path) {
        if (searchId !== currentSearchId) return; 
        updateCharacterPos(node.r, node.c);
        playSound(220, 'sine', 0.05, 0.05);
        if (!((node.r === startNode.r && node.c === startNode.c) || (node.r === endNode.r && node.c === endNode.c))) {
            node.mesh.material.emissive.set(0xffa500); 
            node.mesh.material.emissiveIntensity = 2;
        }
        await sleep(150);
    }
}

async function knightAttackAnimation() {
    const targetPos = character.position.clone();
    playSound(110, 'sawtooth', 0.3, 0.2);
    for(let i=0; i<10; i++) {
        knight.position.lerp(targetPos, 0.3);
        await sleep(20);
    }
    playSound(880, 'sine', 0.5, 0.2);
    spawnMagicParticles(character.position.x, 0.8, character.position.z, 0xffffff, 30);
    spawnMagicParticles(character.position.x, 0.8, character.position.z, 0xffa500, 20);
    character.visible = false;
    for(let i=0; i<10; i++) {
        knight.position.lerp(new THREE.Vector3(knight.position.x, 0, knight.position.z), 0.2);
        await sleep(20);
    }
}

export async function startSearch() {
    if (isRunning) {
        currentSearchId++; // Stop previous search
        isRunning = false;
        await sleep(100); 
    }
    
    currentSearchId++;
    const mySearchId = currentSearchId;
    
    clearVisuals();
    isRunning = true;
    startBtn.disabled = true;

    const algo = algorithmSelect.value;
    let path = [];

    if (algo === 'astar') path = await runAStar(mySearchId);
    else if (algo === 'dfs') path = await runDFS(mySearchId);
    else path = await runBFS(mySearchId);

    if (mySearchId !== currentSearchId) return; // Abort if a new search started

    // Update Comparison Table with Real Data
    if (path.length > 0) {
        if (algo === 'bfs') {
            document.getElementById('live-bfs-steps').innerText = path.length;
            document.getElementById('live-bfs-nodes').innerText = nodesVisitedDisplay.innerText;
            document.getElementById('live-bfs-steps').classList.add('highlight-green');
        } else if (algo === 'dfs') {
            document.getElementById('live-dfs-steps').innerText = path.length;
            document.getElementById('live-dfs-nodes').innerText = nodesVisitedDisplay.innerText;
            document.getElementById('live-dfs-steps').classList.add('highlight-red');
        }
        
        draw3DPath(path);
        await animateCharacter(path, mySearchId);
        if (mySearchId === currentSearchId) await knightAttackAnimation();
    } else {
        alert("Bị kẹt trong bóng tối! Không tìm thấy đường thoát.");
    }
    
    if (mySearchId === currentSearchId) {
        isRunning = false;
        startBtn.disabled = false;
    }
}

export function getPathData(node) {
    const path = [];
    let curr = node;
    let totalCost = 0;
    while (curr) {
        path.unshift(curr);
        if (curr.parent) totalCost += TERRAIN_TYPES[curr.type].cost;
        curr = curr.parent;
    }
    pathCostDisplay.innerText = totalCost;
    pathLengthDisplay.innerText = path.length - 1;
    return path;
}

function draw3DPath(path) {
    if (path.length < 2) return;
    
    const points = path.map(node => {
        const offset = (GRID_SIZE * CELL_SIZE) / 2;
        return new THREE.Vector3(node.r * CELL_SIZE - offset + CELL_SIZE/2, 0.4, node.c * CELL_SIZE - offset + CELL_SIZE/2);
    });

    // Use a fiery orange color for the knight's path
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0);
    const tubeGeo = new THREE.TubeGeometry(curve, path.length * 12, 0.1, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({ 
        color: 0xffa500, // Orange
        emissive: 0xff4500, // Fiery Red-Orange
        emissiveIntensity: 15,
        transparent: true,
        opacity: 0.9
    });
    pathLine = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(pathLine);
}

async function animateCharacter(path, searchId) {
    for (let node of path) {
        if (searchId !== currentSearchId) return; 
        updateCharacterPos(node.r, node.c);
        playSound(220, 'sine', 0.05, 0.05);
        if (!((node.r === startNode.r && node.c === startNode.c) || (node.r === endNode.r && node.c === endNode.c))) {
            node.mesh.material.emissive.set(0xffa500); 
            node.mesh.material.emissiveIntensity = 2;
        }
        await sleep(150);
    }
}

async function knightAttackAnimation() {
    const startPos = knight.position.clone();
    const targetPos = character.position.clone();

    // 1. Knight Lunges forward
    playSound(110, 'sawtooth', 0.3, 0.2);
    for(let i=0; i<10; i++) {
        knight.position.lerp(targetPos, 0.3);
        await sleep(20);
    }

    // 2. Wizard Explodes/Vanish
    playSound(880, 'sine', 0.5, 0.2);
    spawnMagicParticles(character.position.x, 0.8, character.position.z, 0xffffff, 30);
    spawnMagicParticles(character.position.x, 0.8, character.position.z, 0xffa500, 20);
    character.visible = false;

    // 3. Knight steps back slightly in victory
    const backPos = new THREE.Vector3().lerpVectors(targetPos, startPos, 0.4);
    for(let i=0; i<15; i++) {
        knight.position.lerp(backPos, 0.1);
        await sleep(30);
    }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    controls.update();
    
    if (character) {
        character.position.y = Math.sin(Date.now() * 0.005) * 0.15 + 0.3;
        character.rotation.y += delta * 0.5;
    }

    if (knight) {
        knight.rotation.y = Math.sin(Date.now() * 0.001) * 0.1;
        const ring = knight.children.find(c => c.geometry.type === 'TorusGeometry');
        if (ring) {
            ring.rotation.z += delta;
            ring.scale.setScalar(1 + Math.sin(Date.now() * 0.003) * 0.15);
        }
    }

    // Advanced Decorations Animations
    scene.traverse(obj => {
        if (!obj.userData) return;
        
        if (obj.userData.isCrystal) {
            obj.scale.setScalar(1 + Math.sin(Date.now() * 0.002 + obj.userData.offset) * 0.1);
            obj.material.emissiveIntensity = 2 + Math.sin(Date.now() * 0.003 + obj.userData.offset) * 1.0;
        }
        if (obj.userData.isRune) {
            obj.rotation.z += delta;
            obj.position.y = 0.8 + Math.sin(Date.now() * 0.002) * 0.1;
        }
        if (obj.userData.isWisp) {
            obj.position.y = 0.6 + Math.sin(Date.now() * 0.003 + obj.userData.offset) * 0.2;
            obj.position.x += Math.sin(Date.now() * 0.002 + obj.userData.offset) * 0.01;
            obj.rotation.y += delta * 2;
        }
        if (obj.userData.isBird) {
            const time = Date.now() * 0.002 + obj.userData.offset;
            obj.position.x = obj.userData.origX + Math.cos(time) * 0.3;
            obj.position.z = obj.userData.origZ + Math.sin(time) * 0.3;
            obj.position.y = 1.2 + Math.sin(time * 2) * 0.1;
        }
        if (obj.userData.isFlower) {
            obj.material.emissiveIntensity = 1.5 + Math.sin(Date.now() * 0.004 + obj.userData.offset) * 1.0;
            obj.scale.setScalar(0.8 + Math.sin(Date.now() * 0.004 + obj.userData.offset) * 0.2);
        }
        if (obj.userData.isBubble) {
            obj.position.y += delta * 0.5;
            if (obj.position.y > 0.4) obj.position.y = 0;
            obj.scale.setScalar(0.5 + obj.position.y * 2);
        }
        if (obj.userData.isTree) {
            obj.rotation.z = Math.sin(Date.now() * 0.001 + obj.position.x) * 0.05;
        }
    });

    embers.forEach(ember => {
        ember.position.y -= ember.userData.speed;
        ember.rotation.x += 0.01;
        ember.rotation.z += 0.01;
        if (ember.position.y < 0) resetEmber(ember);
    });

    if (Math.random() < 0.05) {
        // Spawn random embers near walls
        grid.flat().filter(n => n.type === 'wall').forEach(n => {
            if (Math.random() < 0.01) spawnMagicParticles(n.mesh.position.x, 0.5, n.mesh.position.z, 0xef4444, 1);
        });
    }

    // Blood ripple
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            if (grid[r][c].type === 'water') {
                grid[r][c].mesh.position.y = Math.sin(Date.now() * 0.001 + r * 0.8 + c * 0.8) * 0.04 - 0.01;
            }
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.mesh.position.add(p.velocity);
        p.life -= delta * 1.5;
        p.mesh.material.opacity = p.life;
        p.mesh.scale.setScalar(p.life);
        if (p.life <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
        }
    }
    
    if (composer) composer.render();
    else renderer.render(scene, camera);
}

brushBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        brushBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentBrush = btn.dataset.type;
    });
});

startBtn.addEventListener('click', startSearch);
resetBtn.addEventListener('click', () => {
    isRunning = false;
    clearVisuals();
    for(let r=0; r<GRID_SIZE; r++) {
        for(let c=0; c<GRID_SIZE; c++) {
            if ((r === startNode.r && c === startNode.c) || (r === endNode.r && c === endNode.c)) continue;
            updateCell(r, c, 'grass');
        }
    }
});

init();
