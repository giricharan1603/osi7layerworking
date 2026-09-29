/**
 * Implements Dijkstra's Pathing and Spanning Broadcast Tree Generations
 */

export function findShortestPath(graph, startNode, endNode) {
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

    for (let neighbor in neighbors) {
      const newCost = currentCost + neighbors[neighbor];
      if (newCost < costs[neighbor]) {
        costs[neighbor] = newCost;
        parents[neighbor] = currentNode;
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

// Concept 5: Broadcast Tree (Minimum Spanning Tree via Prim's Algorithm)
export function generateBroadcastTree(graph, startNode) {
  const mstEdges = [];
  const visited = new Set([startNode]);
  
  while (visited.size < Object.keys(graph).length) {
    let minEdge = { from: null, to: null, weight: Infinity };
    
    for (let u of visited) {
      for (let v in graph[u]) {
        if (!visited.has(v) && graph[u][v] < minEdge.weight) {
          minEdge = { from: u, to: v, weight: graph[u][v] };
        }
      }
    }
    
    if (minEdge.to === null) break; // Disconnected graph safeguard
    visited.add(minEdge.to);
    mstEdges.push(minEdge);
  }
  return mstEdges;
}
