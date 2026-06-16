import type { LoopRange } from "@/types";
import type { PackedSheet } from "./pack";

/**
 * TexturePacker-style sprite sheet descriptor (array-of-frames form), which
 * Godot, Unity, Phaser, PixiJS, etc. can import. Each frame records its packed
 * rect, the trimmed offset within the source, the original source size, and a
 * pivot (reserved, defaults to center).
 */
export interface SpritesheetJsonFrame {
  filename: string;
  frame: { x: number; y: number; w: number; h: number };
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  pivot: { x: number; y: number };
}

export interface SpritesheetJson {
  frames: SpritesheetJsonFrame[];
  meta: {
    app: string;
    version: string;
    image: string;
    format: string;
    size: { w: number; h: number };
    scale: string;
    fps: number;
    frameCount: number;
    loop: LoopRange | null;
  };
}

export function buildSpritesheetJson(
  packed: PackedSheet,
  meta: { image: string; fps: number; loop: LoopRange | null },
): SpritesheetJson {
  return {
    frames: packed.frames.map((f) => ({
      filename: f.filename,
      frame: { x: f.x, y: f.y, w: f.width, h: f.height },
      spriteSourceSize: { x: f.trimX, y: f.trimY, w: f.width, h: f.height },
      sourceSize: { w: f.sourceWidth, h: f.sourceHeight },
      pivot: { x: 0.5, y: 0.5 },
    })),
    meta: {
      app: "SpriteForge",
      version: "1.0",
      image: meta.image,
      format: "RGBA8888",
      size: { w: packed.width, h: packed.height },
      scale: "1",
      fps: meta.fps,
      frameCount: packed.frames.length,
      loop: meta.loop,
    },
  };
}
