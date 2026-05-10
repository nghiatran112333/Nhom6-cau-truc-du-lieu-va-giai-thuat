# Unity Knight & Wizard Pathfinding Demo

## Overview
A small Unity 3D prototype that demonstrates A* (NavMesh) path‑finding in a medieval‑fantasy setting. The player controls a **Wizard** (camera) and watches **Knights** navigate a grid with terrain costs (grass, forest, water, walls). The wizard can cast spells to add/remove obstacles, triggering a dynamic NavMesh rebuild.

## Features
- 15×15 grid generated at runtime.
- Terrain tiles with different movement costs.
- Unity NavMesh (A*‑style) for optimal routes.
- Dynamic NavMesh updates after terrain changes.
- UI HUD with algorithm selection, brush picker, and live statistics (total cost, steps, visited nodes).
- Particle effects for movement trails and spell casting.
- Built for **PC Standalone** and **WebGL**.

## Getting Started
1. Install **Unity Hub** and add Unity **2022 LTS** (or later).
2. Open Unity Hub → **Add** → select the folder `c:\Users\tranm\OneDrive\Máy tính\cấu trúc giải thuật\UnityKnightWizard`.
3. Open the project, press **Play**.
4. Use the UI to select an algorithm (A* or BFS), choose a brush, and click on the terrain to modify it.
5. Press **Start** to watch the knights move.

## Build
- **Standalone (Windows)**: `File → Build Settings → PC, Mac & Linux Standalone → Build`.
- **WebGL**: `File → Build Settings → WebGL → Build`. The output can be hosted on any static web server.

## Folder Structure
```
UnityKnightWizard/
│─ Assets/
│   │─ Scenes/Main.unity          # Main scene
│   │─ Scripts/
│   │   ├─ GridManager.cs          # Generates grid & NavMesh modifiers
│   │   ├─ Pathfinder.cs          # Handles BFS / A* logic & UI updates
│   │   ├─ WizardController.cs    # Camera & spell‑casting
│   │   ├─ KnightAI.cs            # NavMeshAgent movement & trail effect
│   │   └─ UIManager.cs           # UI interactions
│   │─ Prefabs/
│   │   ├─ Tile.prefab            # Tile with MeshRenderer, NavMeshModifier
│   │   ├─ Knight.prefab          # Knight model + NavMeshAgent
│   │   └─ Wizard.prefab           # Wizard avatar (optional)
│   └─ Materials/                 # Tile materials (grass, forest, water, wall)
│─ ProjectSettings/                # Unity project settings (default)
│─ Packages/                      # URP & TextMeshPro packages
└─ README.md
```

---
Feel free to modify the scripts, replace the placeholder models with your own assets, or extend the gameplay (e.g., add combat, multiple wizard abilities, enemies).
