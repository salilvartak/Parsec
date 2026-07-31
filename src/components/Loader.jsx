import React from 'react';

// App-wide brand loader: the hexagon shell traces, the braces breathe, the code
// lines type in, the cursor dot pulses. Animations live in index.css (.pl-*).
// `color` defaults to the theme accent; `label` sets the accessible name.
export default function Loader({ size = 96, color = 'var(--accent)', label = 'Loading', style }) {
  return (
    <svg className="pl-svg" width={size} height={size} viewBox="0 0 512 512" role="img" aria-label={label} style={style}>
      <g fill="none" stroke={color} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round">
        <path className="pl-hex" d="M 283.7 96 L 380.7 152 Q 408.4 168 408.4 200 L 408.4 312 Q 408.4 344 380.7 360 L 283.7 416 Q 256 432 228.3 416 L 131.3 360 Q 103.6 344 103.6 312 L 103.6 200 Q 103.6 168 131.3 152 L 228.3 96 Q 256 80 283.7 96 Z" />
        <path className="pl-brace-left" d="M 202 174 C 187 174, 176 181, 176 196 L 176 230 C 176 244, 166 254, 152 258 C 166 262, 176 272, 176 286 L 176 320 C 176 335, 187 342, 202 342" />
        <path className="pl-brace-right" d="M 310 174 C 325 174, 336 181, 336 196 L 336 230 C 336 244, 346 254, 360 258 C 346 262, 336 272, 336 286 L 336 320 C 336 335, 325 342, 310 342" />
        <path className="pl-line pl-line-1" d="M 208 230 H 308" />
        <path className="pl-line pl-line-2" d="M 208 264 H 302" />
        <path className="pl-line pl-line-3" d="M 208 298 H 264" />
      </g>
      <circle className="pl-dot" cx="290" cy="298" r="8" fill={color} />
    </svg>
  );
}

// Centered full-area loader with an optional caption.
export function LoaderOverlay({ label = 'Loading…', size = 110, backdrop = true }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 14,
      alignItems: 'center', justifyContent: 'center', zIndex: 20,
      background: backdrop ? 'color-mix(in srgb, var(--bg) 78%, transparent)' : 'transparent',
      backdropFilter: backdrop ? 'blur(1.5px)' : 'none',
    }}>
      <Loader size={size} />
      {label && <span style={{ font: "500 12.5px 'Inter',sans-serif", color: 'var(--text2)' }}>{label}</span>}
    </div>
  );
}
