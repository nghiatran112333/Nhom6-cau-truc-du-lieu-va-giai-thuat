// WeightedAStar.cs
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;

namespace PathfindingProject
{
    /// <summary>
    /// Implements a weighted A* pathfinding algorithm that works on a grid of tiles.
    /// Each tile can have a movement cost (e.g., grass=1, forest=3, water=10, wall=Infinity).
    /// The algorithm returns a list of world positions that the NavMeshAgent can follow.
    /// </summary>
    public class WeightedAStar
    {
        private readonly GridManager _gridManager;
        private readonly PriorityQueue<Node> _openSet = new PriorityQueue<Node>();
        private readonly HashSet<Node> _closedSet = new HashSet<Node>();

        public WeightedAStar(GridManager gridManager)
        {
            _gridManager = gridManager;
        }

        public List<Vector3> FindPath(int startX, int startZ, int goalX, int goalZ)
        {
            Node startNode = new Node(startX, startZ, 0f, Heuristic(startX, startZ, goalX, goalZ), null);
            _openSet.Clear();
            _openSet.Enqueue(startNode, startNode.FScore);
            _closedSet.Clear();

            while (!_openSet.IsEmpty)
            {
                Node current = _openSet.Dequeue();
                if (current.X == goalX && current.Z == goalZ)
                    return ReconstructPath(current);

                _closedSet.Add(current);
                foreach (Node neighbor in GetNeighbors(current))
                {
                    if (_closedSet.Contains(neighbor)) continue;

                    float tentativeG = current.GScore + neighbor.Cost;
                    bool inOpen = false;
                    // Since our PriorityQueue does not support containment check, we simply enqueue duplicate with better cost.
                    // The queue will later pop the better one first.
                    neighbor.GScore = tentativeG;
                    neighbor.FScore = tentativeG + Heuristic(neighbor.X, neighbor.Z, goalX, goalZ);
                    neighbor.CameFrom = current;
                    _openSet.Enqueue(neighbor, neighbor.FScore);
                }
            }
            // No path found
            return null;
        }

        private List<Vector3> ReconstructPath(Node endNode)
        {
            List<Vector3> path = new List<Vector3>();
            Node current = endNode;
            while (current != null)
            {
                path.Add(_gridManager.GetTileCenter(current.X, current.Z));
                current = current.CameFrom;
            }
            path.Reverse();
            return path;
        }

        private IEnumerable<Node> GetNeighbors(Node node)
        {
            int[,] dirs = new int[,] { {1,0}, {-1,0}, {0,1}, {0,-1} };
            for (int i = 0; i < 4; i++)
            {
                int nx = node.X + dirs[i,0];
                int nz = node.Z + dirs[i,1];
                if (nx < 0 || nz < 0 || nx >= _gridManager.gridWidth || nz >= _gridManager.gridHeight)
                    continue;
                // Retrieve terrain cost from the Tile component (assumes Tile.cs provides a public Cost field)
                var tileObj = _gridManager.Tiles[nx, nz];
                var tileComp = tileObj.GetComponent<Tile>();
                if (tileComp == null) continue; // safety
                float cost = tileComp.Cost;
                if (cost >= Mathf.Infinity) continue; // impassable
                yield return new Node(nx, nz, cost, 0f, null);
            }
        }

        private float Heuristic(int x1, int z1, int x2, int z2)
        {
            // Manhattan distance – good for grid movement
            return Mathf.Abs(x1 - x2) + Mathf.Abs(z1 - z2);
        }

        private class Node
        {
            public int X, Z;
            public float GScore; // cost from start
            public float FScore; // G + heuristic
            public float Cost;   // movement cost of this tile
            public Node CameFrom;
            public Node(int x, int z, float cost, float f, Node cameFrom)
            {
                X = x; Z = z; Cost = cost; FScore = f; CameFrom = cameFrom; GScore = 0f;
            }
        }
    }
}
