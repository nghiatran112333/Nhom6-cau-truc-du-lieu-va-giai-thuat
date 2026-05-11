import { TERRAIN_TYPES } from './constants.js';
import { sleep, heuristic, getNeighbors, isObstacle, getPathData } from './utils.js';
import { playSearchTick } from './audio.js';

export async function runAStar(context) {
    const { grid, startNode, endNode, searchId, state, ui, visuals } = context;
    
    let openSet = [grid[startNode.r][startNode.c]];
    grid[startNode.r][startNode.c].g = 0;
    grid[startNode.r][startNode.c].f = heuristic(grid[startNode.r][startNode.c], grid[endNode.r][endNode.c]);
    
    let visitedCount = 0;

    while (openSet.length > 0) {
        if (searchId !== state.currentSearchId) return []; 

        openSet.sort((a, b) => a.f - b.f);
        const current = openSet.shift();
        
        if (current.isVisited) continue;
        current.isVisited = true;
        visitedCount++;
        ui.nodesVisitedDisplay.innerText = visitedCount;

        if (current.r === endNode.r && current.c === endNode.c) {
            return getPathData(current, ui.pathCostDisplay, ui.pathLengthDisplay);
        }

        if (!(current.r === startNode.r && current.c === startNode.c)) {
            visuals.spawnMagicParticles(current.mesh.position.x, 0.2, current.mesh.position.z, 0x4ade80, 2);
            playSearchTick(visitedCount, 'astar');
            await sleep(5);
        }

        const neighbors = getNeighbors(current, grid);
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

export async function runBFS(context) {
    const { grid, startNode, endNode, searchId, state, ui, visuals } = context;
    
    let queue = [grid[startNode.r][startNode.c]];
    grid[startNode.r][startNode.c].isVisited = true;
    let visitedCount = 0;

    while (queue.length > 0) {
        if (searchId !== state.currentSearchId) return [];

        const current = queue.shift();
        visitedCount++;
        ui.nodesVisitedDisplay.innerText = visitedCount;

        if (current.r === endNode.r && current.c === endNode.c) {
            return getPathData(current, ui.pathCostDisplay, ui.pathLengthDisplay);
        }

        if (!(current.r === startNode.r && current.c === startNode.c)) {
            visuals.spawnMagicParticles(current.mesh.position.x, 0.2, current.mesh.position.z, 0xffa500, 3);
            playSearchTick(visitedCount, 'bfs');
            await sleep(20); 
        }

        const neighbors = getNeighbors(current, grid);
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

export async function runDFS(context) {
    const { grid, startNode, endNode, searchId, state, ui, visuals } = context;
    
    let stack = [grid[startNode.r][startNode.c]];
    grid[startNode.r][startNode.c].isVisited = true;
    let visitedCount = 0;

    while (stack.length > 0) {
        if (searchId !== state.currentSearchId) return [];

        const current = stack.pop();
        visitedCount++;
        ui.nodesVisitedDisplay.innerText = visitedCount;

        if (current.r === endNode.r && current.c === endNode.c) {
            return getPathData(current, ui.pathCostDisplay, ui.pathLengthDisplay);
        }

        if (!(current.r === startNode.r && current.c === startNode.c)) {
            visuals.spawnMagicParticles(current.mesh.position.x, 0.2, current.mesh.position.z, 0xff4500, 3);
            playSearchTick(visitedCount, 'dfs');
            await sleep(20);
        }

        const neighbors = getNeighbors(current, grid);
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
