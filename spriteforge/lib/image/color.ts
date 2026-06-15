export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Parse a `#rgb` / `#rrggbb` hex string to RGB, or null when malformed. */
export function hexToRgb(hex: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** Format an RGB triple as an uppercase `#RRGGBB` hex string. */
export function rgbToHex({ r, g, b }: RGB): string {
  const to = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

/** True when the hex string is a valid `#rgb` / `#rrggbb` color. */
export function isValidHex(hex: string): boolean {
  return hexToRgb(hex) !== null;
}
