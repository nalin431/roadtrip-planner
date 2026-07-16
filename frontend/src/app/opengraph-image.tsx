import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'Most-Fun Path — Road Trip Planner';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          backgroundColor: '#f1ebdd',
          backgroundImage:
            'radial-gradient(circle at 20% 15%, rgba(139,115,85,0.14) 0, transparent 45%), radial-gradient(circle at 85% 65%, rgba(61,90,69,0.12) 0, transparent 50%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: 22,
            letterSpacing: 4,
            textTransform: 'uppercase',
            color: '#c1592c',
            fontWeight: 600,
            marginBottom: 20,
          }}
        >
          Most-Fun Path
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 72,
            fontWeight: 600,
            color: '#1f2e23',
            lineHeight: 1.1,
            maxWidth: 900,
          }}
        >
          Plan a road trip worth the detour
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 28,
            color: 'rgba(31,46,35,0.7)',
            marginTop: 28,
            maxWidth: 780,
          }}
        >
          A route solver that detours for what&apos;s worth seeing, within a budget you set.
        </div>
      </div>
    ),
    { ...size }
  );
}
