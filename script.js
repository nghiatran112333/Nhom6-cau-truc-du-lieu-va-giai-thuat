import { SceneManager } from './js/scene_manager.js';
import { UI, initUI } from './js/ui_manager.js';
import { runAStar, runBFS, runDFS } from './js/algorithms.js';
import { GRID_SIZE, TERRAIN_TYPES } from './js/constants.js';
import { playSound, playThudSound, playWaterSound, playMagicSweep, bgm } from './js/audio.js';
import { sleep, isObstacle } from './js/utils.js';

const state = {
    startNode: { r: 8, c: 8 },
    endNode: { r: 1, c: 1 },
    isRunning: false,
    currentSearchId: 0,
    currentBrush: 'wall',
    activeSearchId: 0 // To track if a search is still valid for animations
};

const sceneManager = new SceneManager();

async function init() {
    sceneManager.init(document.getElementById('canvas-container'));
    
    initUI({
        onGenerateMaze: generateRandomMaze,
        onReset: resetAll,
        onStartSearch: startSearch,
        onBrushChange: (type) => { state.currentBrush = type; },
        onModalOpen: () => playSound(660, 'triangle', 0.1),
        onMusicToggle: () => bgm.toggle(),
        onVolumeChange: (val) => bgm.setVolume(val)
    });

    UI.musicTitle.innerText = "Thủy Trúc - Anh Rất Nhớ Em Remix";

    // Interaction for clicking the grid
    window.addEventListener('mousedown', onMouseDown);

    // Initial positioning
    sceneManager.updateCharacterPos(state.startNode.r, state.startNode.c);
    sceneManager.updateWizardPos(state.endNode);

    sceneManager.animate();
}

function onMouseDown(event) {
    if (state.isRunning) return;
    
    sceneManager.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    sceneManager.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    sceneManager.raycaster.setFromCamera(sceneManager.mouse, sceneManager.camera);
    const gridMeshes = sceneManager.grid.flat().map(n => n.mesh);
    const intersects = sceneManager.raycaster.intersectObjects(gridMeshes);

    if (intersects.length > 0) {
        const obj = intersects[0].object;
        const { r, c } = obj.userData;
        
        if (state.currentBrush === 'start') {
            if (isObstacle(sceneManager.grid[r][c]) || (r === state.endNode.r && c === state.endNode.c)) return;
            state.startNode = { r, c };
            sceneManager.updateCharacterPos(r, c);
            playSound(440, 'triangle', 0.1);
        } else if (state.currentBrush === 'end') {
            if (isObstacle(sceneManager.grid[r][c]) || (r === state.startNode.r && c === state.startNode.c)) return;
            state.endNode = { r, c };
            sceneManager.updateWizardPos(state.endNode);
            playSound(660, 'triangle', 0.1);
        } else {
            if ((r === state.startNode.r && c === state.startNode.c) || (r === state.endNode.r && c === state.endNode.c)) return;
            sceneManager.updateCell(r, c, state.currentBrush);
            
            // Specialized sounds for terrain
            if (state.currentBrush === 'wall') playThudSound();
            else if (state.currentBrush === 'water') playWaterSound();
            else if (state.currentBrush === 'forest') playSound(150, 'sawtooth', 0.1, 0.05);
            else playSound(330, 'sine', 0.05, 0.05);
        }
        sceneManager.clearVisuals(state.startNode, state.endNode);
        resetUIStats();
    }
}

function generateRandomMaze() {
    if (state.isRunning) return;
    sceneManager.clearVisuals(state.startNode, state.endNode);
    for(let r=0; r<GRID_SIZE; r++) {
        for(let c=0; c<GRID_SIZE; c++) {
            if ((r === state.startNode.r && c === state.startNode.c) || (r === state.endNode.r && c === state.endNode.c)) continue;
            if (Math.random() < 0.3) sceneManager.updateCell(r, c, 'wall');
            else sceneManager.updateCell(r, c, 'grass');
        }
    }
    playThudSound();
    setTimeout(() => playThudSound(), 100);
    resetUIStats();
}

function resetAll() {
    if (state.isRunning) {
        state.currentSearchId++;
        state.isRunning = false;
    }
    sceneManager.clearVisuals(state.startNode, state.endNode);
    resetUIStats();
}

function resetUIStats() {
    UI.pathCostDisplay.innerText = '-';
    UI.pathLengthDisplay.innerText = '-';
    UI.nodesVisitedDisplay.innerText = '-';
}

async function startSearch() {
    if (state.isRunning) {
        state.currentSearchId++;
        state.isRunning = false;
        await sleep(100); 
    }
    
    state.currentSearchId++;
    const mySearchId = state.currentSearchId;
    state.activeSearchId = mySearchId;
    
    sceneManager.clearVisuals(state.startNode, state.endNode);
    state.isRunning = true;
    UI.startBtn.disabled = true;

    const algo = UI.algorithmSelect.value;
    let path = [];

    const context = {
        grid: sceneManager.grid,
        startNode: state.startNode,
        endNode: state.endNode,
        searchId: mySearchId,
        state: state,
        ui: UI,
        visuals: sceneManager
    };

    if (algo === 'astar') path = await runAStar(context);
    else if (algo === 'dfs') path = await runDFS(context);
    else path = await runBFS(context);

    if (mySearchId !== state.currentSearchId) return;

    if (path.length > 0) {
        // Update Comparison Table
        if (algo === 'bfs') {
            UI.bfsSteps.innerText = path.length;
            UI.bfsNodes.innerText = UI.nodesVisitedDisplay.innerText;
            UI.bfsSteps.classList.add('highlight-green');
        } else if (algo === 'dfs') {
            UI.dfsSteps.innerText = path.length;
            UI.dfsNodes.innerText = UI.nodesVisitedDisplay.innerText;
            UI.dfsSteps.classList.add('highlight-red');
        }
        
        sceneManager.draw3DPath(path);
        await sceneManager.animateCharacter(path, state);
        if (mySearchId === state.currentSearchId) await sceneManager.knightAttackAnimation();
    } else {
        alert("Bị kẹt trong bóng tối! Không tìm thấy đường thoát.");
    }
    
    if (mySearchId === state.currentSearchId) {
        state.isRunning = false;
        UI.startBtn.disabled = false;
    }
}

init();
