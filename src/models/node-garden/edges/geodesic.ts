/** 球面上の 2 点間の測地線弧を分割点列で返す (slerp) */
export function geodesicArc(
  p1: readonly [number, number, number],
  p2: readonly [number, number, number],
  radius: number,
  segments: number,
): Float32Array {
  // p1, p2 を単位ベクトル化
  const len1 = Math.sqrt(p1[0] * p1[0] + p1[1] * p1[1] + p1[2] * p1[2]);
  const len2 = Math.sqrt(p2[0] * p2[0] + p2[1] * p2[1] + p2[2] * p2[2]);

  if (len1 < 1e-10 || len2 < 1e-10 || segments < 1) {
    return new Float32Array(0);
  }

  const u1x = p1[0] / len1;
  const u1y = p1[1] / len1;
  const u1z = p1[2] / len1;
  const u2x = p2[0] / len2;
  const u2y = p2[1] / len2;
  const u2z = p2[2] / len2;

  const dot = Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y + u1z * u2z));

  // 同一点
  if (dot > 1 - 1e-10) {
    const out = new Float32Array(3);
    out[0] = p1[0];
    out[1] = p1[1];
    out[2] = p1[2];
    return out;
  }

  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);

  // 対蹠点 (sinOmega ≈ 0): 任意の直交ベクトルで中間経路を決定
  if (sinOmega < 1e-10) {
    // u1 に直交するベクトルを生成
    let perpX: number, perpY: number, perpZ: number;
    if (Math.abs(u1x) < Math.abs(u1y)) {
      // u1 × (1,0,0)
      perpX = 0;
      perpY = u1z;
      perpZ = -u1y;
    } else {
      // u1 × (0,1,0)
      perpX = -u1z;
      perpY = 0;
      perpZ = u1x;
    }
    const perpLen = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);
    perpX /= perpLen;
    perpY /= perpLen;
    perpZ /= perpLen;

    const pointCount = segments + 1;
    const out = new Float32Array(pointCount * 3);
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const angle = t * Math.PI;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      out[s * 3] = (cosA * u1x + sinA * perpX) * radius;
      out[s * 3 + 1] = (cosA * u1y + sinA * perpY) * radius;
      out[s * 3 + 2] = (cosA * u1z + sinA * perpZ) * radius;
    }
    return out;
  }

  const pointCount = segments + 1;
  const out = new Float32Array(pointCount * 3);

  for (let s = 0; s <= segments; s++) {
    const t = s / segments;
    const a = Math.sin((1 - t) * omega) / sinOmega;
    const b = Math.sin(t * omega) / sinOmega;

    out[s * 3] = (a * u1x + b * u2x) * radius;
    out[s * 3 + 1] = (a * u1y + b * u2y) * radius;
    out[s * 3 + 2] = (a * u1z + b * u2z) * radius;
  }

  return out;
}
