import { useId } from "react";
import { cn } from "@/lib/utils";
import { AGENTS } from "@/lib/agents";
import { SIZE_PX, type ShapeProps } from "./shape-props";

/**
 * Manifold, the editor. A saddle surface (z = x^2 - y^2) as a wireframe
 * patch: the canonical picture of a 2-manifold embedded in 3-space.
 *
 * Construction: the surface is the region between two u-curves that sag
 * toward the viewer (quadratics from x 16 to 80 dipping through the
 * midline) closed along the side edges. Two interior u-curves repeat the
 * sag; three v-curves arch the opposite way (control points pushed
 * outward), which is exactly the opposing curvature that reads as a
 * saddle rather than a bowl. One curve of each family is drawn heavier,
 * like the fold line an editor runs a thumb down.
 */
export function Manifold({
  size = "md",
  color = AGENTS.manifold.cssVar,
  className,
  title = "manifold",
  muted = false,
}: ShapeProps) {
  const id = useId();
  const px = SIZE_PX[size];

  return (
    <svg
      role="img"
      width={px}
      height={px}
      viewBox="0 0 96 96"
      className={cn(muted && "opacity-50", className)}
      style={{ color }}
    >
      <title>{title}</title>
      <defs>
        <radialGradient id={`${id}-shade`} cx="48%" cy="38%" r="80%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.45" />
          <stop offset="60%" stopColor="currentColor" stopOpacity="0.14" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.05" />
        </radialGradient>
      </defs>
      <g className={size === "lg" ? "mc-anim-spin" : undefined}>
        {/* Surface patch between the top and bottom u-curves */}
        <path
          d="M 16 30 Q 48 50 80 30 L 80 62 Q 48 82 16 62 Z"
          fill={`url(#${id}-shade)`}
        />
        {/* u-family: sagging curves, the heavier one is the fold */}
        <path d="M 16 30 Q 48 50 80 30" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <path d="M 16 46 Q 48 66 80 46" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
        <path d="M 16 62 Q 48 82 80 62" fill="none" stroke="currentColor" strokeWidth="2" />
        {/* v-family: arching curves with the opposite curvature */}
        <path d="M 26 33 Q 20 48 26 65" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <path d="M 48 40 Q 48 56 48 72" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.7" />
        <path d="M 70 33 Q 76 48 70 65" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      </g>
    </svg>
  );
}
