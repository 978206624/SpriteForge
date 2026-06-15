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
