using UnityEngine;
using UnityEngine.AI;

public class GridManager : MonoBehaviour
{
    [Header("Grid Settings")]
    public int rows = 15;
    public int columns = 15;
    public float tileSize = 1f;
    public GameObject tilePrefab;

    [Header("NavMesh Settings")]
    public NavMeshSurface navMeshSurface;

    private GameObject[,] gridTiles;

    void Start()
    {
        GenerateGrid();
        BakeNavMesh();
    }

    // Generates the grid of tile GameObjects
    public void GenerateGrid()
    {
        gridTiles = new GameObject[rows, columns];
        Vector3 origin = transform.position - new Vector3(columns, 0, rows) * tileSize * 0.5f;
        for (int x = 0; x < columns; x++)
        {
            for (int z = 0; z < rows; z++)
            {
                Vector3 pos = origin + new Vector3(x * tileSize, 0, z * tileSize);
                GameObject tile = Instantiate(tilePrefab, pos, Quaternion.identity, transform);
                tile.name = $"Tile_{x}_{z}";
                // Optional: assign grid coordinates to Tile component
                Tile tileComp = tile.GetComponent<Tile>();
                if (tileComp != null)
                {
                    tileComp.Coords = new Vector2Int(x, z);
                }
                gridTiles[x, z] = tile;
            }
        }
    }

    // Re‑bakes the NavMesh whenever terrain changes
    public void BakeNavMesh()
    {
        if (navMeshSurface != null)
        {
            navMeshSurface.BuildNavMesh();
        }
        else
        {
            Debug.LogWarning("NavMeshSurface reference missing on GridManager.");
        }
    }
}
