"use client";
import * as React from "react";
import { useEffect, useRef, useState } from "react";

// Define a point type
type Point = { date: string; amount: number };

// Normalize points to get min and max values
function normalize(points: Point[]) {
  if (points.length === 0) return { points: [], min: 0, max: 0 };
  const min = Math.min(...points.map((p) => p.amount));
  const max = Math.max(...points.map((p) => p.amount));
  return { points, min, max };
}

// A more complex sparkline with smoothing, gradient fill, and interactive tooltip
export default function Sparkline({
  points,
  width = 300,
  height = 80,
  stroke = "#60a5fa",
  fill,
  ariaLabel,
  summary,
}: {
  points: Point[];
  width?: number | string;
  height?: number;
  stroke?: string;
  fill?: string; // if not provided, a gradient will be used
  ariaLabel?: string;
  summary?: string;
}) {
  const { min, max } = React.useMemo(() => normalize(points), [points]);
  const padding = 8;
  // width may be a number or responsive string; compute w later after measuring
  const h = height - padding * 2;
  const n = points.length;
  if (n < 2) return null;
  // Generate a smoothed path using Catmull-Rom to Cubic Bezier conversion
  function getSmoothPath(points: { x: number; y: number }[]) {
    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i === 0 ? points[0] : points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i + 2 < points.length ? points[i + 2] : p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  // State for interactive tooltip (hover) to highlight a point
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // Find the nearest point based on x coordinate
    const distances = coordsFinal.map((pt) => Math.abs(pt.x - x));
    const minDistance = Math.min(...distances);
    const index = distances.indexOf(minDistance);
    setHoverIndex(index);
  };

  const handleMouseLeave = () => setHoverIndex(null);

  const uid = React.useId();
  const titleId = `sparkline-title-${uid}`;
  const descId = `sparkline-desc-${uid}`;

  // Responsive width support: if width is a string (e.g. '100%'), measure parent
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(
    typeof width === "number" ? (width as number) : null
  );

  useEffect(() => {
    if (typeof width === "number") return; // fixed width
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = Math.max(120, Math.floor(el.getBoundingClientRect().width));
      setMeasuredWidth(w);
    });
    ro.observe(el);
    setMeasuredWidth(
      Math.max(120, Math.floor(el.getBoundingClientRect().width))
    );
    return () => ro.disconnect();
  }, [width]);

  const svgWidth =
    measuredWidth ?? (typeof width === "number" ? (width as number) : 300);

  // Recompute coords using measured svgWidth
  const svgW = typeof svgWidth === "number" ? svgWidth : 300;
  const wComputed = svgW - padding * 2;
  const coordsFinal = points.map((p, i) => ({
    x: (i / (n - 1)) * wComputed + padding,
    y:
      max === min
        ? height / 2
        : height - padding - ((p.amount - min) / (max - min)) * h,
    amount: p.amount,
    date: p.date,
  }));
  const smoothPathFinal = getSmoothPath(coordsFinal);

  return (
    <div
      ref={containerRef}
      style={{ width: typeof width === "string" ? width : undefined }}
    >
      <svg
        width={svgWidth}
        height={height}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
      >
        <title id={titleId}>{ariaLabel ?? "Sparkline"}</title>
        <desc id={descId}>
          {summary ??
            (points.length > 0
              ? `Values from ${points[0].date} (${points[0].amount}) to ${
                  points[points.length - 1].date
                } (${points[points.length - 1].amount})`
              : "No data")}
        </desc>
        <defs>
          <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Draw the smoothed line */}
        <path d={smoothPathFinal} fill="none" stroke={stroke} strokeWidth={2} />
        {/* Draw the area under the curve using the gradient fill */}
        <path
          d={`${smoothPathFinal} L${svgWidth - padding},${
            height - padding
          } L${padding},${height - padding} Z`}
          fill={fill || "url(#sparklineGradient)"}
        />
        {/* Highlight the nearest point on hover with amount label */}
        {hoverIndex !== null && (
          <>
            <circle
              cx={coordsFinal[hoverIndex].x}
              cy={coordsFinal[hoverIndex].y}
              r={4}
              fill="#f87171"
              stroke="#fff"
              strokeWidth={1.5}
            />
            <text
              x={coordsFinal[hoverIndex].x}
              y={coordsFinal[hoverIndex].y - 8}
              fill="#333"
              fontSize="10"
              textAnchor="middle"
            >
              {coordsFinal[hoverIndex].amount}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
