import { NodeGardenParams, defaultParams } from "./params";

export interface EdgeResult {
  pairs: Uint32Array;
  distances: Float32Array;
  count: number;
}

/**
 * Node Garden シミュレーション。
 * ノードの位置・速度・エッジ接続を管理する純粋な計算クラス (Three.js 非依存)。
 */
export class NodeGardenSimulation {
  public params: NodeGardenParams;
  public positions: Float32Array;
  public velocities: Float32Array;

  private _nodeCount: number;

  constructor(params: Partial<NodeGardenParams> = {}) {
    this.params = { ...defaultParams, ...params };
    this._nodeCount = this.params.nodeCount;
    this.positions = new Float32Array(this._nodeCount * 3);
    this.velocities = new Float32Array(this._nodeCount * 3);
    this.randomize();
  }

  get nodeCount(): number {
    return this._nodeCount;
  }

  /** ノードをランダムに配置する。 */
  randomize(): void {
    const { spread } = this.params;
    for (let i = 0; i < this._nodeCount; i++) {
      const i3 = i * 3;
      this.positions[i3] = (Math.random() - 0.5) * spread * 2;
      this.positions[i3 + 1] = (Math.random() - 0.5) * spread * 2;
      this.positions[i3 + 2] = (Math.random() - 0.5) * spread * 2;

      this.velocities[i3] = (Math.random() - 0.5) * 0.02;
      this.velocities[i3 + 1] = (Math.random() - 0.5) * 0.02;
      this.velocities[i3 + 2] = (Math.random() - 0.5) * 0.02;
    }
  }

  /** シミュレーションを1ステップ進める。 */
  update(delta: number): void {
    const speed = this.params.speed * delta;
    const halfSpread = this.params.spread;

    for (let i = 0; i < this._nodeCount; i++) {
      const i3 = i * 3;
      for (let axis = 0; axis < 3; axis++) {
        this.positions[i3 + axis] += this.velocities[i3 + axis] * speed;

        // 境界で反射
        if (Math.abs(this.positions[i3 + axis]) > halfSpread) {
          this.velocities[i3 + axis] *= -1;
          this.positions[i3 + axis] = Math.sign(this.positions[i3 + axis]) * halfSpread;
        }
      }
    }
  }

  /** edgeMaxDistance 以内のノード対を計算して返す。 */
  computeEdges(): EdgeResult {
    const maxDist = this.params.edgeMaxDistance;
    const maxDistSq = maxDist * maxDist;
    const n = this._nodeCount;

    const tmpPairs: number[] = [];
    const tmpDists: number[] = [];

    for (let i = 0; i < n; i++) {
      const ix = this.positions[i * 3];
      const iy = this.positions[i * 3 + 1];
      const iz = this.positions[i * 3 + 2];

      for (let j = i + 1; j < n; j++) {
        const dx = ix - this.positions[j * 3];
        const dy = iy - this.positions[j * 3 + 1];
        const dz = iz - this.positions[j * 3 + 2];
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq < maxDistSq) {
          tmpPairs.push(i, j);
          tmpDists.push(Math.sqrt(distSq));
        }
      }
    }

    return {
      pairs: new Uint32Array(tmpPairs),
      distances: new Float32Array(tmpDists),
      count: tmpDists.length,
    };
  }
}
