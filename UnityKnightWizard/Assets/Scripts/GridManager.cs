using UnityEngine;
using UnityEngine.AI;
using System.Collections.Generic;

public class GridManager : MonoBehaviour {
    public int gridSize = 15;
    public float cellSize = 1f;
    public GameObject tilePrefab;
    public Material grassMat, forestMat, waterMat, wallMat;
    public NavMeshSurface navMeshSurface;

    private Tile[,] tiles;

    // Terrain cost dictionary (used by NavMeshModifierVolume)
    private readonly Dictionary<string, float> terrainCosts = new Dictionary<string, float> {
        { "grass", 1f },
        { "forest", 3f },
        { "water", 10f },
        { "wall", Mathf.Infinity }
    };

    void Start() {
        GenerateGrid();
        BuildNavMesh();
    }

    void GenerateGrid() {
        tiles = new Tile[gridSize, gridSize];
        float offset = (gridSize * cellSize) / 2f;
        for (int r = 0; r < gridSize; r++) {
            for (int c = 0; c < gridSize; c++) {
                Vector3 pos = new Vector3(r * cellSize - offset, 0, c * cellSize - offset);
                GameObject go = Instantiate(tilePrefab, pos, Quaternion.identity, transform);
                go.name = $"Tile_{r}_{c}";
                Tile tile = go.GetComponent<Tile>();
                tile.Init(r, c, "grass", this);
                ApplyMaterial(tile, "grass");
                tiles[r, c] = tile;
            }
        }
    }

    public void SetTileType(int r, int c, string type) {
        Tile tile = tiles[r, c];
        tile.SetType(type);
        ApplyMaterial(tile, type);
        // Update NavMesh Modifier Volume
        NavMeshModifierVolume vol = tile.GetComponent<NavMeshModifierVolume>();
        if (vol != null) {
            vol.area = NavMesh.GetAreaFromName(type);
            vol.shape = NavMeshModifierVolumeShape.Cube;
            vol.size = new Vector3(cellSize, 0.1f, cellSize);
            vol.center = new Vector3(0, 0.05f, 0);
        }
        // Re‑bake NavMesh asynchronously (cheap for small grid)
        BuildNavMesh();
    }

    void ApplyMaterial(Tile tile, string type) {
        Renderer rend = tile.GetComponent<Renderer>();
        switch (type) {
            case "grass": rend.sharedMaterial = grassMat; break;
            case "forest": rend.sharedMaterial = forestMat; break;
            case "water": rend.sharedMaterial = waterMat; break;
            case "wall": rend.sharedMaterial = wallMat; break;
        }
    }

    public void BuildNavMesh() {
        if (navMeshSurface != null) {
            navMeshSurface.BuildNavMesh();
        }
    }

    public Tile GetTile(int r, int c) => tiles[r, c];
}
