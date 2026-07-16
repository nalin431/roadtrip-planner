'use client';

import { useCallback, useId, useRef } from 'react';

interface DetourDialProps {
  value: number; // percent, 0-30
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

const SIZE = 120;
const CENTER = SIZE / 2;
const RADIUS = 46;
const START_ANGLE = -220; // degrees, gauge sweep start
const SWEEP = 260; // degrees, total sweep

// Rounded to a fixed precision so server- and client-rendered markup match
// exactly — different JS engines can return the last bit or two of
// Math.cos/Math.sin differently for the same input, which otherwise trips
// React's hydration mismatch check on values that are visually identical.
function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function polarToCartesian(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: round(CENTER + radius * Math.cos(rad)),
    y: round(CENTER + radius * Math.sin(rad)),
  };
}

function describeArc(startAngle: number, endAngle: number, radius: number) {
  const start = polarToCartesian(startAngle, radius);
  const end = polarToCartesian(endAngle, radius);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export default function DetourDial({ value, onChange, min = 0, max = 30 }: DetourDialProps) {
  const id = useId();
  const trackRef = useRef<SVGSVGElement>(null);

  const pct = (value - min) / (max - min);
  const needleAngle = START_ANGLE + pct * SWEEP;

  const updateFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = trackRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = clientX - rect.left - (rect.width / 2);
      const y = clientY - rect.top - (rect.height / 2);
      const angle = (Math.atan2(y, x) * 180) / Math.PI;

      // Normalize into the gauge's sweep range (handles wraparound at -180/180)
      let relative = angle - START_ANGLE;
      if (relative < 0) relative += 360;
      const clamped = Math.max(0, Math.min(SWEEP, relative));
      const next = min + (clamped / SWEEP) * (max - min);
      onChange(Math.round(next));
    },
    [min, max, onChange]
  );

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    updateFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.buttons !== 1) return;
    updateFromPointer(e.clientX, e.clientY);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      onChange(Math.min(max, value + 1));
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      onChange(Math.max(min, value - 1));
      e.preventDefault();
    }
  };

  const needleTip = polarToCartesian(needleAngle, RADIUS - 6);

  return (
    <div className="flex flex-col items-center gap-1">
      <label htmlFor={id} className="font-mono text-xs uppercase tracking-widest text-ranger">
        Detour budget
      </label>
      <svg
        ref={trackRef}
        id={id}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label="Detour budget percent"
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onKeyDown={handleKeyDown}
        className="cursor-pointer touch-none focus:outline-none"
      >
        {/* background track */}
        <path
          d={describeArc(START_ANGLE, START_ANGLE + SWEEP, RADIUS)}
          fill="none"
          stroke="#8b7355"
          strokeOpacity={0.25}
          strokeWidth={8}
          strokeLinecap="round"
        />
        {/* filled progress */}
        <path
          d={describeArc(START_ANGLE, needleAngle, RADIUS)}
          fill="none"
          stroke="#c1592c"
          strokeWidth={8}
          strokeLinecap="round"
        />
        {/* tick marks at 0, 10, 20, 30 */}
        {[0, 10, 20, 30].map((tick) => {
          const tickAngle = START_ANGLE + ((tick - min) / (max - min)) * SWEEP;
          const inner = polarToCartesian(tickAngle, RADIUS - 12);
          const outer = polarToCartesian(tickAngle, RADIUS - 4);
          return (
            <line
              key={tick}
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              stroke="#1f2e23"
              strokeOpacity={0.3}
              strokeWidth={2}
            />
          );
        })}
        {/* needle */}
        <line
          x1={CENTER}
          y1={CENTER}
          x2={needleTip.x}
          y2={needleTip.y}
          stroke="#1f2e23"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
        <circle cx={CENTER} cy={CENTER} r={5} fill="#1f2e23" />

        <text
          x={CENTER}
          y={CENTER + 28}
          textAnchor="middle"
          className="fill-canopy font-mono"
          style={{ fontSize: 18, fontWeight: 600 }}
        >
          {value}%
        </text>
      </svg>
    </div>
  );
}
