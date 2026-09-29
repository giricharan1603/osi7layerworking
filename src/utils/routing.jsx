/**
 * Implements Dijkstra's Shortest Path Algorithm and Prim's Minimum Spanning Tree
 */

export function findShortestPath(graph, startNode, endNode) {
  if (!graph || !startNode || !endNode) return [];
  if (startNode === endNode) return [startNode];
  if (!graph[startNode] || !graph[endNode]) return [];

  const costs = {};
  const parents = {};
  const processed = [];

  for (let node in graph) {
    costs[node] = Infinity;
    parents[node] = null;
  }
  costs[startNode] = 0;

  const getLowestCostNode = (costs, processed) => {
    return Object.keys(costs).reduce((lowest, node) => {
      if (lowest === null || costs[node] < costs[lowest]) {
        if (!processed.includes(node)) lowest = node;
      }
      return lowest;
    }, null);
  };

  let currentNode = getLowestCostNode(costs, processed);

  while (currentNode) {
    const currentCost = costs[currentNode];
    const neighbors = graph[currentNode];

    if (neighbors) {
      for (let neighbor in neighbors) {
        const newCost = currentCost + neighbors[neighbor];
        if (newCost < costs[neighbor]) {
          costs[neighbor] = newCost;
          parents[neighbor] = currentNode;
        }
      }
    }
    processed.push(currentNode);
    currentNode = getLowestCostNode(costs, processed);
  }

  const optimalPath = [];
  let trace = endNode;
  while (trace) {
    optimalPath.unshift(trace);
    trace = parents[trace];
  }

  return optimalPath[0] === startNode ? optimalPath : [];
}

// Minimum Spanning Tree via Prim's Algorithm for broadcast routing
export function generateBroadcastTree(graph, startNode) {
  if (!graph || !startNode || !graph[startNode]) return [];

  const mstEdges = [];
  const visited = new Set([startNode]);
  const totalNodes = Object.keys(graph).length;
  
  while (visited.size < totalNodes) {
    let minEdge = { from: null, to: null, weight: Infinity };
    
    for (let u of visited) {
      if (!graph[u]) continue;
      for (let v in graph[u]) {
        if (!visited.has(v) && graph[u][v] < minEdge.weight) {
          minEdge = { from: u, to: v, weight: graph[u][v] };
        }
      }
    }
    
    if (!minEdge.to) break; // Disconnected graph safeguard
    visited.add(minEdge.to);
    mstEdges.push(minEdge);
  }
  return mstEdges;
}

/**
 * Organizes broadcast spanning tree edges into outward levels from the root node
 * for realistic concurrent propagation without teleportation.
 */
export function buildBroadcastLevels(edges, rootNode) {
  if (!edges || edges.length === 0 || !rootNode) return [];

  // Build bidirectional adjacency for the tree edges
  const adj = {};
  edges.forEach(edge => {
    if (!adj[edge.from]) adj[edge.from] = [];
    if (!adj[edge.to]) adj[edge.to] = [];
    adj[edge.from].push(edge.to);
    adj[edge.to].push(edge.from);
  });

  // Calculate BFS depth of each node starting from rootNode
  const depth = { [rootNode]: 0 };
  const queue = [rootNode];
  const visited = new Set([rootNode]);

  while (queue.length > 0) {
    const curr = queue.shift();
    const currDepth = depth[curr];
    const neighbors = adj[curr] || [];
    for (let neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        depth[neighbor] = currDepth + 1;
        queue.push(neighbor);
      }
    }
  }

  // Orient each edge outward from shallower node to deeper node
  const directed = [];
  edges.forEach(edge => {
    const dFrom = depth[edge.from] !== undefined ? depth[edge.from] : 0;
    const dTo = depth[edge.to] !== undefined ? depth[edge.to] : 0;
    if (dFrom <= dTo) {
      directed.push({ from: edge.from, to: edge.to, weight: edge.weight, level: dFrom });
    } else {
      directed.push({ from: edge.to, to: edge.from, weight: edge.weight, level: dTo });
    }
  });

  const maxLevel = directed.reduce((max, e) => Math.max(max, e.level), 0);
  const levels = [];
  for (let l = 0; l <= maxLevel; l++) {
    const levelEdges = directed.filter(e => e.level === l);
    if (levelEdges.length > 0) {
      levels.push(levelEdges);
    }
  }

  return levels;
}

