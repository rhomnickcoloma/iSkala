import { ImageResponse } from 'next/og'

export const OG_SIZE = { width: 1200, height: 630 }

const DOTS = ['A', 'C', 'D', 'E', 'G']

export function renderOgImage(headline: string) {
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
          background: 'linear-gradient(135deg, #0d1b2a 0%, #14141a 55%, #2a1708 100%)',
          color: '#fff',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2, color: '#5dade2' }}>FretWiki</div>
        <div style={{ fontSize: 30, color: '#9aa4b2', marginTop: 8 }}>By NIXX Music</div>
        <div style={{ fontSize: 44, fontWeight: 600, marginTop: 48, maxWidth: 900, lineHeight: 1.2 }}>{headline}</div>
        <div style={{ display: 'flex', gap: 20, marginTop: 56 }}>
          {DOTS.map((n, i) => (
            <div
              key={n}
              style={{
                width: 76,
                height: 76,
                borderRadius: 38,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 34,
                fontWeight: 700,
                background: i === 0 ? '#c0392b' : '#4a4f57',
                border: '3px solid rgba(255,255,255,0.25)',
              }}
            >
              {n}
            </div>
          ))}
        </div>
      </div>
    ),
    OG_SIZE,
  )
}
