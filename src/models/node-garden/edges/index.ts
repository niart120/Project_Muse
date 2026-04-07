import type { NodeState, EdgeResult } from "../simulation";
import type { EdgeAlgorithm, NodeGardenParams } from "../params";
import { computeDistanceEdges } from "./distance";
import { computeKnnEdges } from "./knn";
import { computeMstEdges } from "./mst";
import { computeGabrielEdges } from "./gabriel";

/** エッジ計算関数のシグネチャ */
export type EdgeStrategy = (state: NodeState, params: NodeGardenParams) => EdgeResult;

export const edgeStrategies: Record<EdgeAlgorithm, EdgeStrategy> = {
  distance: computeDistanceEdges,
  knn: computeKnnEdges,
  mst: computeMstEdges,
  gabriel: computeGabrielEdges,
};

export { computeDistanceEdges } from "./distance";
export { computeKnnEdges } from "./knn";
export { computeMstEdges } from "./mst";
export { computeGabrielEdges } from "./gabriel";
export { geodesicArc } from "./geodesic";
