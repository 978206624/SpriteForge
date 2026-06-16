import { rgbToHex } from "./color";

/**
 * Read the color of one pixel from ImageData and return it as `#RRGGBB`.
 * Coordinates are clamped into bounds. Returns null for empty image data.
 */
export function pixelToHex(image: ImageData, x: number, y: number): string | null {
  if (image.width === 0 || image.height === 0) return null;
  const px = Math.max(0, Math.min(image.width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(image.height - 1, Math.round(y)));
  const i = (py * image.width + px) * 4;
  const d = image.data;
  return rgbToHex({ r: d[i], g: d[i + 1], b: d[i + 2] });
}

/**
 * Estimate a frame's background color by sampling its edges — the four corners
 * plus four edge midpoints — and returning the most common one, quantized so
 * compression noise groups together. Character clips usually have a uniform
 * background around the subject, so the edge mode is a far better default key
 * color than a fixed green. Returns null for empty image data.
 */
export function sampleBackgroundColor(image: ImageData): string | null {
  const { width: w, height: h, data } = image;
  if (w === 0 || h === 0) return null;
  const cx = (w - 1) >> 1;
  const cy = (h - 1) >> 1;
  const pts: [number, number][] = [
    [0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1], // corners
    [cx, 0], [cx, h - 1], [0, cy], [w - 1, cy], // edge midpoints
  ];
  const groups = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (const [x, y] of pts) {
    const i = (y * w + x) * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const key = `${r >> 3}|${g >> 3}|${b >> 3}`; // ~32 levels/channel groups noise
    const e = groups.get(key);
    if (e) e.n++;
    else groups.set(key, { n: 1, r, g, b });
  }
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const e of groups.values()) if (!best || e.n > best.n) best = e;
  return best ? rgbToHex({ r: best.r, g: best.g, b: best.b }) : null;
}

/**
 * Map a pointer position on a rendered element to source-image pixel
 * coordinates, accounting for the element's display size vs the image's
 * intrinsic size (the image is drawn with `object-contain`/full-bleed scaling).
 */
export function clientToImageCoords(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number } {
  // the canvas is rendered at its own aspect ratio filling `rect`, so a simple
  // proportional map from rect-space to image-space is correct
  const x = ((clientX - rect.left) / rect.width) * imageWidth;
  const y = ((clientY - rect.top) / rect.height) * imageHeight;
  return { x, y };
}
