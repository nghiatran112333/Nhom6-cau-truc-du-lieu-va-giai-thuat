/**
 * FILE: algorithms.js
 * Chứa toàn bộ các thuật toán tìm kiếm và logic tìm đường của Nhóm 6
 */

import { 
    grid, GRID_SIZE, startNode, endNode, currentSearchId, 
    TERRAIN_TYPES, nodesVisitedDisplay, 
    spawnMagicParticles, playSound, sleep 
} from './script.js';

// --- CÁC HÀM HỖ TRỢ (HELPERS) ---

export function heuristic(a, b) {
    // Khoảng cách Manhattan
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

export function isObstacle(node) {
    if (!node) return true;
    const type = node.type;
    // Chặn Tường, Rừng và Nước
    if (type === 'wall' || type === 'forest' || type === 'water') return true;
    if (TERRAIN_TYPES[type].cost === Infinity) return true;
    
    // Kiểm tra trực tiếp vật thể (Đá tảng)
    const hasCrystals = node.decorations.some(d => d.userData && d.userData.isCrystal);
    if (hasCrystals) return true;
    
    return false;
}

export function getNeighbors(node) {
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

export function getPathData(node) {
    const path = [];
    let curr = node;
    while (curr) {
        path.unshift(curr);
        curr = curr.parent;
    }
    return path;
}

// --- CÁC THUẬT TOÁN CHÍNH ---

export async function runBFS(searchId) {
    let queue = [grid[startNode.r][startNode.c]];
    grid[startNode.r][startNode.c].isVisited = true;
    let visitedCount = 0;

    while (queue.length > 0) {
        if (searchId !== currentSearchId) return []; // Dừng nếu có yêu cầu mới

        const current = queue.shift();
        visitedCount++;
        nodesVisitedDisplay.innerText = visitedCount;

        if (current.r === endNode.r && current.c === endNode.c) return getPathData(current);

        if (!(current.r === startNode.r && current.c === startNode.c)) {
            spawnMagicParticles(current.mesh.position.x, 0.2, current.mesh.position.z, 0xffa500, 3);
            playSound(880 + visitedCount, 'sine', 0.02, 0.05);
            await sleep(20); 
        }

        const neighbors = getNeighbors(current);
        for (let neighbor of neighbors) {
            if (!neighbor.isVisited && !isObstacle(neighbor)) {
                neighbor.isVisited = true;
                neighbor.parent = current;
                queue.push(neighbor);
            }
        }
    }
    return [];
}

export async function runDFS(searchId) {
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

        const neighbors = getNeighbors(current);
        for (let neighbor of neighbors) {
            if (!neighbor.isVisited && !isObstacle(neighbor)) {
                neighbor.isVisited = true;
                neighbor.parent = current;
                stack.push(neighbor);
            }
        }
    }
    return [];
}

export async function runAStar(searchId) {
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

        const neighbors = getNeighbors(current);
        for (let neighbor of neighbors) {
            if (isObstacle(neighbor) || neighbor.isVisited) continue;

            const cost = TERRAIN_TYPES[neighbor.type].cost;
            const tentativeG = current.g + cost;
            if (tentativeG < neighbor.g) {
                neighbor.parent = current;
                neighbor.g = tentativeG;
                neighbor.f = neighbor.g + heuristic(neighbor, grid[endNode.r][endNode.c]);
                if (!openSet.includes(neighbor)) openSet.push(neighbor);
            }
        }
    }
    return [];
}
