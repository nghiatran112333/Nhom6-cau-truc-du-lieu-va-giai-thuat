// AgentManager.cs
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;

namespace PathfindingProject
{
    /// <summary>
    /// Manages a pool of Knight agents. Spawns them, assigns start/goal cells, and moves them along the
    /// path returned by WeightedAStar.
    /// </summary>
    public class AgentManager : MonoBehaviour
    {
        [Header("Agent Settings")]
        public GameObject knightPrefab; // Prefab with a NavMeshAgent component
        public int agentCount = 5;
        public float spawnHeight = 0.5f;

        [Header("Grid References")]
        public GridManager gridManager;

        private List<KnightAI> _agents = new List<KnightAI>();
        private WeightedAStar _pathfinder;

        private void Awake()
        {
            if (gridManager == null)
                gridManager = FindObjectOfType<GridManager>();
            _pathfinder = new WeightedAStar(gridManager);
        }

        private void Start()
        {
            SpawnAgents();
            AssignRandomGoals();
        }

        private void SpawnAgents()
        {
            for (int i = 0; i < agentCount; i++)
            {
                // Choose a random valid cell for spawning
                int x = Random.Range(0, gridManager.gridWidth);
                int z = Random.Range(0, gridManager.gridHeight);
                Vector3 spawnPos = gridManager.GetTileCenter(x, z);
                spawnPos.y += spawnHeight;
                GameObject go = Instantiate(knightPrefab, spawnPos, Quaternion.identity, transform);
                go.name = $"Knight_{i}";
                var ai = go.AddComponent<KnightAI>();
                ai.Initialize(this, x, z);
                _agents.Add(ai);
            }
        }

        private void AssignRandomGoals()
        {
            foreach (var ai in _agents)
            {
                int goalX, goalZ;
                // Ensure goal is different from start
                do
                {
                    goalX = Random.Range(0, gridManager.gridWidth);
                    goalZ = Random.Range(0, gridManager.gridHeight);
                } while (goalX == ai.StartX && goalZ == ai.StartZ);

                List<Vector3> path = _pathfinder.FindPath(ai.StartX, ai.StartZ, goalX, goalZ);
                if (path != null && path.Count > 0)
                {
                    ai.SetPath(path);
                }
                else
                {
                    Debug.LogWarning($"Agent {ai.name} could not find a path to ({goalX},{goalZ}).");
                }
            }
        }
    }

    /// <summary>
    /// Simple AI component that follows a list of waypoints using a NavMeshAgent.
    /// </summary>
    [RequireComponent(typeof(NavMeshAgent))]
    public class KnightAI : MonoBehaviour
    {
        private NavMeshAgent _agent;
        private Queue<Vector3> _waypoints = new Queue<Vector3>();
        public int StartX { get; private set; }
        public int StartZ { get; private set; }
        private AgentManager _manager;

        public void Initialize(AgentManager manager, int startX, int startZ)
        {
            _manager = manager;
            StartX = startX;
            StartZ = startZ;
            _agent = GetComponent<NavMeshAgent>();
            _agent.autoBraking = false;
        }

        public void SetPath(List<Vector3> path)
        {
            // Clear any existing waypoints and enqueue new ones
            _waypoints.Clear();
            foreach (var pt in path)
                _waypoints.Enqueue(pt);
            MoveToNext();
        }

        private void Update()
        {
            if (_agent.pathPending) return;
            if (!_agent.hasPath && _waypoints.Count > 0)
                MoveToNext();
        }

        private void MoveToNext()
        {
            if (_waypoints.Count == 0) return;
            Vector3 next = _waypoints.Dequeue();
            _agent.SetDestination(next);
        }
    }
}
