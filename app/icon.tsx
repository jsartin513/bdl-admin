import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: '#1e3a5f',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          fontWeight: 800,
          fontSize: 14,
          color: '#f59e0b',
          letterSpacing: '-0.5px',
        }}
      >
        BDL
      </div>
    ),
    { ...size }
  );
}
