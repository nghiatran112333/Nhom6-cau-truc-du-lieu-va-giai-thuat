import { TERRAIN_TYPES, GRID_SIZE } from './constants.js';

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function heuristic(a, b) {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

export function getNeighbors(node, grid) {
    const res = [];
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let [dr, dc] of dirs) {
        const nr = node.r + dr, nc = node.c + dc;
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
            const neighbor = grid[nr][nc];
            if (neighbor) res.push(neighbor);
        }
    }
    return res;
}

export function isObstacle(node) {
    if (!node) return true;
    const type = node.type;
    if (type === 'wall' || type === 'forest' || type === 'water') return true;
    if (TERRAIN_TYPES[type].cost === Infinity) return true;
    
    const hasCrystals = node.decorations.some(d => d.userData && d.userData.isCrystal);
    if (hasCrystals) return true;
    
    return false;
}

export function getPathData(node, pathCostDisplay, pathLengthDisplay) {
    const path = [];
    let curr = node;
    let totalCost = 0;
    while (curr) {
        path.unshift(curr);
        if (curr.parent) totalCost += TERRAIN_TYPES[curr.type].cost;
        curr = curr.parent;
    }
    if (pathCostDisplay) pathCostDisplay.innerText = totalCost;
    if (pathLengthDisplay) pathLengthDisplay.innerText = path.length - 1;
    return path;
}
