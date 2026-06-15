import { cn } from "@/lib/utils";

interface CheckerboardProps {
  /** checker square size in px */
  size?: number;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Transparent-background checkerboard, drawn with the theme's --checker-a/b
 * tokens via CSS gradients. Used behind chroma-keyed (transparent) frames so
 * the removed background reads clearly in both light and dark themes.
 */
export function Checkerboard({
  size = 12,
  className,
  children,
}: CheckerboardProps) {
  const s = `${size}px`;
  const doubled = `${size * 2}px`;
  return (
    <div
      className={cn("bg-checker-a", className)}
      style={{
        backgroundImage:
          "linear-gradient(45deg, var(--checker-b) 25%, transparent 25%), " +
          "linear-gradient(-45deg, var(--checker-b) 25%, transparent 25%), " +
          "linear-gradient(45deg, transparent 75%, var(--checker-b) 75%), " +
          "linear-gradient(-45deg, transparent 75%, var(--checker-b) 75%)",
        backgroundSize: `${doubled} ${doubled}`,
        backgroundPosition: `0 0, 0 ${s}, ${s} -${s}, -${s} 0`,
      }}
    >
      {children}
    </div>
  );
}
