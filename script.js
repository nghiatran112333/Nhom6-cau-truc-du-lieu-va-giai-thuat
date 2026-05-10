import * as THREE from 'https://cdn.skypack.dev/three@0.132.2';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.132.2/examples/jsm/postprocessing/UnrealBloomPass.js';

/**
 * PROJECT: NHÓM 6 - CẤU TRÚC DỮ LIỆU & GIẢI THUẬT
 * MÔ TẢ: Hệ thống mô phỏng tìm đường 3D (BFS, DFS, A*)
 */

// --- 1. CẤU HÌNH (CONFIG) ---
const GRID_SIZE = 10;
const CELL_SIZE = 2.0; 
const TERRAIN_TYPES = {
    grass:  { cost: 1,  color: 0x312e81, emissive: 0x1e1b4b, metalness: 0.1, roughness: 0.9 },
    forest: { cost: 3,  color: 0x064e3b, emissive: 0x022c22, hasTrees: true, metalness: 0.2, roughness: 1.0 },
    water:  { cost: 10, color: 0x1e40af, emissive: 0x1d4ed8, opacity: 0.8, metalness: 0.8, roughness: 0.2 },
    wall:   { cost: Infinity, color: 0xef4444, emissive: 0x991b1b, hasRocks: true, metalness: 0.6, roughness: 0.4 }
};

// --- 2. BIẾN TOÀN CỤC (GLOBALS) ---
let scene, camera, renderer, controls, raycaster, mouse, composer;
let grid = [];
let startNode = { r: 8, c: 8 };
let endNode = { r: 1, c: 1 };
let isRunning = false;
let currentSearchId = 0; 
let currentBrush = 'wall';
let character, knight, pathLine = null;
let particles = [], embers = [];
let clock = new THREE.Clock();

// Hệ thống âm thanh
let audioCtx = null;
function playSound(freq, type = 'sine', duration = 0.1, volume = 0.1) {
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
const startBtn = document.getElementById('start-btn');
const mazeBtn = document.getElementById('maze-btn');
const resetBtn = document.getElementById('reset-btn');
const algorithmSelect = document.getElementById('algorithm');
const pathCostDisplay = document.getElementById('path-cost');
const pathLengthDisplay = document.getElementById('path-length');
const nodesVisitedDisplay = document.getElementById('nodes-visited');
const brushBtns = document.querySelectorAll('.brush-btn');

// --- 3. KHỞI TẠO (INITIALIZATION) ---
function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    scene.fog = new THREE.Fog(0x020617, 20, 80);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(10, 10, 10);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Lighting
    scene.add(new THREE.AmbientLight(0x4c1d95, 0.6));
    const sunLight = new THREE.DirectionalLight(0xef4444, 1.5);
    sunLight.position.set(10, 30, 15);
    sunLight.castShadow = true;
    scene.add(sunLight);

    // Bloom
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    createGrid();
    createWizard();
    createKnight();
    createEmbers();
    animate();

    // Event Listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('mousedown', onMouseDown);
    mazeBtn.addEventListener('click', generateRandomMaze);

    // Modal
    const modal = document.getElementById('comparison-modal');
    const showBtn = document.getElementById('show-comparison');
    const closeBtn = document.getElementsByClassName('close-modal')[0];
    showBtn.onclick = () => { modal.style.display = 'block'; playSound(660, 'triangle', 0.1); };
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => { if (e.target == modal) modal.style.display = 'none'; };
}

// --- 4. CẤU TRÚC BẢN ĐỒ (GRID & OBJECTS) ---
function createGrid() {
    const offset = (GRID_SIZE * CELL_SIZE) / 2;
    for (let r = 0; r < GRID_SIZE; r++) {
        grid[r] = [];
        for (let c = 0; c < GRID_SIZE; c++) {
            const type = 'grass';
            const info = TERRAIN_TYPES[type];
            const geometry = new THREE.BoxGeometry(CELL_SIZE - 0.05, 0.15, CELL_SIZE - 0.05);
            const material = new THREE.MeshStandardMaterial({ color: info.color });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(r * CELL_SIZE - offset + CELL_SIZE/2, 0, c * CELL_SIZE - offset + CELL_SIZE/2);
            mesh.receiveShadow = true;
            mesh.userData = { r, c };
            scene.add(mesh);
            grid[r][c] = { r, c, type, mesh, isVisited: false, parent: null, g: Infinity, f: Infinity, decorations: [] };
        }
    }
}

function updateCell(r, c, type) {
    const node = grid[r][c];
    const info = TERRAIN_TYPES[type];
    node.decorations.forEach(d => scene.remove(d));
    node.decorations = [];
    node.type = type;
    node.mesh.material.color.set(info.color);

    if (info.hasTrees) {
        const treeGeo = new THREE.ConeGeometry(0.25, 0.5, 8);
        const treeMat = new THREE.MeshStandardMaterial({ color: 0x059669 });
        const tree = new THREE.Mesh(treeGeo, treeMat);
        tree.position.set(node.mesh.position.x, 0.3, node.mesh.position.z);
        scene.add(tree);
        node.decorations.push(tree);
    }
    if (type === 'wall') {
        const rockGeo = new THREE.DodecahedronGeometry(0.4);
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
        const rock = new THREE.Mesh(rockGeo, rockMat);
        rock.position.set(node.mesh.position.x, 0.3, node.mesh.position.z);
        scene.add(rock);
        node.decorations.push(rock);
    }
}

function createWizard() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.35, 0.8), new THREE.MeshStandardMaterial({ color: 0x1e1b4b }));
    body.position.y = 0.4;
    group.add(body);
    character = group;
    scene.add(character);
    character.scale.setScalar(1.5);
    updateWizardPos();
}

function updateWizardPos() {
    const offset = (GRID_SIZE * CELL_SIZE) / 2;
    character.position.set(endNode.r * CELL_SIZE - offset + CELL_SIZE/2, 0, endNode.c * CELL_SIZE - offset + CELL_SIZE/2);
}

function createKnight() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.35), new THREE.MeshStandardMaterial({ color: 0x020617 }));
    body.position.y = 0.4;
    group.add(body);
    knight = group;
    scene.add(knight);
    knight.scale.setScalar(1.5);
    updateCharacterPos(startNode.r, startNode.c);
}

function updateCharacterPos(r, c) {
    const offset = (GRID_SIZE * CELL_SIZE) / 2;
    knight.position.set(r * CELL_SIZE - offset + CELL_SIZE/2, 0, c * CELL_SIZE - offset + CELL_SIZE/2);
}

function createEmbers() {
    for(let i=0; i<30; i++) {
        const ember = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: 0xff4500, emissive: 0xff4500, emissiveIntensity: 5 }));
        resetEmber(ember);
        scene.add(ember);
        embers.push(ember);
    }
}

function resetEmber(ember) {
    ember.position.set((Math.random() - 0.5) * 20, Math.random() * 5 + 2, (Math.random() - 0.5) * 20);
    ember.userData.speed = Math.random() * 0.02 + 0.01;
}

// --- 5. LOGIC THUẬT TOÁN (PATHFINDING) ---
function isObstacle(node) {
    if (!node) return true;
    const type = node.type;
    if (type === 'wall' || type === 'forest' || type === 'water') return true;
    return false;
}

function getNeighbors(node) {
    const res = [];
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let [dr, dc] of dirs) {
        const nr = node.r + dr, nc = node.c + dc;
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) res.push(grid[nr][nc]);
    }
    return res;
}

function getPathData(node) {
    const path = [];
    let curr = node;
    while (curr) { path.unshift(curr); curr = curr.parent; }
    return path;
}

function heuristic(a, b) { return Math.abs(a.r - b.r) + Math.abs(a.c - b.c); }

async function runBFS(searchId) {
    let queue = [grid[startNode.r][startNode.c]];
    grid[startNode.r][startNode.c].isVisited = true;
    let visitedCount = 0;
    while (queue.length > 0) {
        if (searchId !== currentSearchId) return [];
        const current = queue.shift();
        visitedCount++;
        nodesVisitedDisplay.innerText = visitedCount;
        if (current.r === endNode.r && current.c === endNode.c) return getPathData(current);
        if (!(current.r === startNode.r && current.c === startNode.c)) {
            spawnMagicParticles(current.mesh.position.x, 0.2, current.mesh.position.z, 0xffa500, 3);
            playSound(880 + visitedCount, 'sine', 0.02, 0.05);
            await sleep(20);
        }
        for (let n of getNeighbors(current)) {
            if (!n.isVisited && !isObstacle(n)) { n.isVisited = true; n.parent = current; queue.push(n); }
        }
    }
    return [];
}

async function runDFS(searchId) {
    let stack = [grid[startNode.r][startNode.c]];
    grid[startNode.r][startNode.c].isVisited = true;
    let visitedCount = 0;
    while (stack.length > 0) {
        if (searchId !== currentSearchId) return [];
        const current = stack.pop();
        visitedCount++;
        nodesVisitedDisplay.innerText = visitedCount;
        if (current.r === endNode.r && current.c === endNode.c) return getPathData(current);
        if (!(current.r === startNode.r && current.c === startNode.c)) {
            spawnMagicParticles(current.mesh.position.x, 0.2, current.mesh.position.z, 0xff4500, 3);
            playSound(440 + visitedCount, 'sawtooth', 0.02, 0.03);
            await sleep(20);
        }
        for (let n of getNeighbors(current)) {
            if (!n.isVisited && !isObstacle(n)) { n.isVisited = true; n.parent = current; stack.push(n); }
        }
    }
    return [];
}

async function runAStar(searchId) {
    let openSet = [grid[startNode.r][startNode.c]];
    grid[startNode.r][startNode.c].g = 0;
    grid[startNode.r][startNode.c].f = heuristic(grid[startNode.r][startNode.c], grid[endNode.r][endNode.c]);
    let visitedCount = 0;
    while (openSet.length > 0) {
        if (searchId !== currentSearchId) return [];
        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();
        if (current.isVisited) continue;
        current.isVisited = true;
        visitedCount++;
        nodesVisitedDisplay.innerText = visitedCount;
        if (current.r === endNode.r && current.c === endNode.c) return getPathData(current);
        if (!(current.r === startNode.r && current.c === startNode.c)) {
            spawnMagicParticles(current.mesh.position.x, 0.2, current.mesh.position.z, 0x4ade80, 2);
            await sleep(5);
        }
        for (let n of getNeighbors(current)) {
            if (isObstacle(n) || n.isVisited) continue;
            const tentativeG = current.g + TERRAIN_TYPES[n.type].cost;
            if (tentativeG < n.g) { n.parent = current; n.g = tentativeG; n.f = n.g + heuristic(n, grid[endNode.r][endNode.c]); if (!openSet.includes(n)) openSet.push(n); }
        }
    }
    return [];
}

// --- 6. XỬ LÝ SỰ KIỆN & HIỂN THỊ ---
async function startSearch() {
    if (isRunning) { currentSearchId++; isRunning = false; await sleep(100); }
    currentSearchId++;
    const myId = currentSearchId;
    clearVisuals();
    isRunning = true;
    startBtn.disabled = true;
    const algo = algorithmSelect.value;
    let path = (algo === 'astar') ? await runAStar(myId) : (algo === 'dfs' ? await runDFS(myId) : await runBFS(myId));
    if (myId !== currentSearchId) return;
    if (path.length > 0) {
        if (algo === 'bfs') { document.getElementById('live-bfs-steps').innerText = path.length; document.getElementById('live-bfs-nodes').innerText = nodesVisitedDisplay.innerText; }
        else if (algo === 'dfs') { document.getElementById('live-dfs-steps').innerText = path.length; document.getElementById('live-dfs-nodes').innerText = nodesVisitedDisplay.innerText; }
        draw3DPath(path);
        await animateCharacter(path, myId);
        if (myId === currentSearchId) await knightAttackAnimation();
    } else alert("Không tìm thấy đường!");
    isRunning = false;
    startBtn.disabled = false;
}

function clearVisuals() {
    grid.flat().forEach(n => { n.isVisited = false; n.parent = null; n.g = Infinity; n.f = Infinity; n.mesh.material.emissiveIntensity = 1; });
    if (character) character.visible = true;
    if (pathLine) { scene.remove(pathLine); pathLine = null; }
    nodesVisitedDisplay.innerText = '-';
    updateCharacterPos(startNode.r, startNode.c);
}

function draw3DPath(path) {
    if (pathLine) scene.remove(pathLine);
    const points = path.map(n => new THREE.Vector3(n.mesh.position.x, 0.3, n.mesh.position.z));
    pathLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xffa500, linewidth: 5 }));
    scene.add(pathLine);
    pathLengthDisplay.innerText = path.length;
}

async function animateCharacter(path, id) {
    for (let n of path) {
        if (id !== currentSearchId) return;
        updateCharacterPos(n.r, n.c);
        playSound(220, 'sine', 0.05, 0.05);
        await sleep(150);
    }
}

async function knightAttackAnimation() {
    const target = character.position.clone();
    playSound(110, 'sawtooth', 0.3, 0.2);
    for(let i=0; i<10; i++) { knight.position.lerp(target, 0.3); await sleep(20); }
    spawnMagicParticles(character.position.x, 0.8, character.position.z, 0xffa500, 30);
    character.visible = false;
}

function generateRandomMaze() {
    clearVisuals();
    grid.flat().forEach(n => {
        if ((n.r === startNode.r && n.c === startNode.c) || (n.r === endNode.r && n.c === endNode.c)) return;
        updateCell(n.r, n.c, Math.random() < 0.3 ? 'wall' : 'grass');
    });
}

function spawnMagicParticles(x, y, z, color, count = 10) {
    for (let i = 0; i < count; i++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 5, transparent: true }));
        p.position.set(x, y, z);
        particles.push({ mesh: p, velocity: new THREE.Vector3((Math.random()-0.5)*0.1, Math.random()*0.15, (Math.random()-0.5)*0.1), life: 1.0 });
        scene.add(p);
    }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function onMouseDown(event) {
    if (isRunning) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(grid.flat().map(n => n.mesh));
    if (intersects.length > 0) {
        const { r, c } = intersects[0].object.userData;
        if (currentBrush === 'start') { if (isObstacle(grid[r][c])) return; startNode = { r, c }; updateCharacterPos(r, c); }
        else if (currentBrush === 'end') { if (isObstacle(grid[r][c])) return; endNode = { r, c }; updateWizardPos(); }
        else { if ((r === startNode.r && c === startNode.c) || (r === endNode.r && c === endNode.c)) return; updateCell(r, c, currentBrush); }
        clearVisuals();
    }
}

function onWindowResize() { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); }

function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    particles.forEach((p, i) => { p.mesh.position.add(p.velocity); p.life -= delta; p.mesh.material.opacity = p.life; if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); } });
    embers.forEach(e => { e.position.y -= e.userData.speed; if (e.position.y < 0) resetEmber(e); });
    controls.update();
    composer.render();
}

brushBtns.forEach(btn => btn.addEventListener('click', () => { brushBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active'); currentBrush = btn.dataset.type; }));
startBtn.addEventListener('click', startSearch);
resetBtn.addEventListener('click', () => { isRunning = false; clearVisuals(); grid.flat().forEach(n => { if (!((n.r === startNode.r && n.c === startNode.c) || (n.r === endNode.r && n.c === endNode.c))) updateCell(n.r, n.c, 'grass'); }); });

init();
