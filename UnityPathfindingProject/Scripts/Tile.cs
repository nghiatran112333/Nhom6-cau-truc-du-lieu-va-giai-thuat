// Tile.cs
using UnityEngine;

namespace PathfindingProject
{
    public enum TerrainType
    {
        Grass = 1,
        Forest = 3,
        Water = 10,
        Wall = 1000 // effectively impassable
    }

    /// <summary>
    /// Component attached to each tile prefab. Stores the movement cost for the weighted A*.
    /// </summary>
    public class Tile : MonoBehaviour
    {
        [Tooltip("Select terrain type – determines movement cost.")]
        public TerrainType terrain = TerrainType.Grass;

        /// <summary>
        /// Current cost for this tile (read‑only). Changing the terrain updates the cost.
        /// </summary>
        public float Cost => (float)terrain;
    }
}
