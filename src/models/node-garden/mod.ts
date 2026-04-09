export { setup } from "./index";
export type { ThemeHandle } from "./index";
export type {
  NodeGardenParams,
  EdgeAlgorithm,
  EdgePathMode,
  NodeShape,
  EdgeStyle,
  SphereBaseMode,
  ColorPreset,
  ColorPresetColors,
} from "./params";
export { defaultParams, colorPresets } from "./params";
export type { NodeState, EdgeResult } from "./simulation";
export { createNodeState, updateNodePositions } from "./simulation";
export type { EdgeStrategy } from "./edges";
export {
  edgeStrategies,
  computeDistanceEdges,
  computeKnnEdges,
  computeMstEdges,
  computeGabrielEdges,
  geodesicArc,
} from "./edges";
export {
  createNodeShapeMaterial,
  shapeIndexMap,
  distanceFadeAlpha,
  computeBreathingOpacity,
  createBloomPipeline,
} from "./shaders";
export type { BloomPipeline } from "./shaders";
export { createSphereGrid, computeSphereGridVertexCount } from "./sphere-grid";
