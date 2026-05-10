// NavMeshHelper.cs
using UnityEngine;
using UnityEngine.AI;

namespace PathfindingProject
{
    /// <summary>
    /// Handles NavMesh building at runtime and provides helpers to update area costs based on tile terrain.
    /// Attach this component to a GameObject that also holds a NavMeshSurface component.
    /// </summary>
    [RequireComponent(typeof(NavMeshSurface))]
    public class NavMeshHelper : MonoBehaviour
    {
        private NavMeshSurface _surface;
        private GridManager _gridManager;

        private void Awake()
        {
            _surface = GetComponent<NavMeshSurface>();
            _gridManager = FindObjectOfType<GridManager>();
            if (_gridManager == null)
                Debug.LogError("NavMeshHelper: GridManager not found in the scene.");
        }

        /// <summary>
        /// Re‑bakes the NavMesh. Call this after any terrain modification.
        /// </summary>
        public void RebuildNavMesh()
        {
            if (_surface != null)
            {
                _surface.BuildNavMesh();
            }
        }

        /// <summary>
        /// Updates the NavMesh area cost for a specific tile based on its terrain type.
        /// This uses NavMeshModifierVolume components attached to each tile.
        /// </summary>
        public void UpdateTileAreaCost(int x, int z)
        {
            if (_gridManager == null) return;
            if (!_gridManager.IsValidCell(x, z)) return;

            var tileObj = _gridManager.Tiles[x, z];
            var tileComp = tileObj.GetComponent<Tile>();
            var modVol = tileObj.GetComponent<NavMeshModifierVolume>();
            if (tileComp == null || modVol == null) return;

            // Map terrain enum to NavMesh area index. Ensure those areas exist in the NavMeshAsset.
            // We'll use the default "Not Walkable" (index 1) for impassable walls, otherwise keep default 0.
            // Users can customize area indices in the Unity editor.
            if (tileComp.terrain == TerrainType.Wall)
                modVol.area = 1; // Assuming area 1 is set to a very high cost.
            else
                modVol.area = 0;
        }
    }
}
