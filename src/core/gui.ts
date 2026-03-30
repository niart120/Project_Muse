import GUI from "lil-gui";

/**
 * lil-gui インスタンスを生成して返す。
 */
export function createGui(title: string): GUI {
  return new GUI({ title });
}
