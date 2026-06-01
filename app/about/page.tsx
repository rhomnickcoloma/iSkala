import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About Us',
  description: 'Learn about FretWiki by NIXX Music — the free interactive fretboard reference tool for guitarists, bassists, and ukulele players.',
}

export default function AboutPage() {
  return (
    <>
      <div className="bg-decoration">
        <span className="bg-note">♪</span>
        <span className="bg-note">♫</span>
        <span className="bg-note">♩</span>
        <span className="bg-note">♬</span>
        <span className="bg-note">🎵</span>
        <span className="bg-note">🎶</span>
      </div>

      <div className="container static-page">
        <nav className="static-nav">
          <Link href="/" className="back-link">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Back to FretWiki
          </Link>
        </nav>

        <div className="static-content">
          <div className="static-hero">
            <img src="/logo.png" alt="FretWiki Logo" className="static-logo" />
            <h1>About FretWiki</h1>
            <p className="static-tagline">By NIXX Music</p>
          </div>

          <section className="static-section">
            <h2>What is FretWiki?</h2>
            <p>
              FretWiki is a free, interactive fretboard reference tool designed for guitarists, bassists,
              and ukulele players of all skill levels. Whether you&apos;re a beginner learning your first
              pentatonic scale or an advanced player exploring exotic modes, FretWiki gives you a visual,
              hands-on way to understand and practice scales across the entire fretboard.
            </p>
          </section>

          <section className="static-section">
            <h2>Our Mission</h2>
            <p>
              We believe that learning music theory should be accessible, visual, and fun. FretWiki was
              built to bridge the gap between knowing scale shapes and truly understanding how they connect
              across the neck. Our goal is to help every musician unlock the fretboard and play with
              confidence in any key.
            </p>
          </section>

          <section className="static-section">
            <h2>Features</h2>
            <div className="feature-grid">
              <div className="feature-card">
                <span className="feature-icon">🎸</span>
                <h3>Multi-Instrument Support</h3>
                <p>Guitar (6-string), Bass (4 &amp; 5-string), and Ukulele with proper tunings for each instrument.</p>
              </div>
              <div className="feature-card">
                <span className="feature-icon">🎵</span>
                <h3>22+ Scales</h3>
                <p>Minor Pentatonic, Major, Blues, Dorian, Mixolydian, Phrygian, Harmonic Minor, Lydian, Diminished, Whole Tone, Augmented, and many more.</p>
              </div>
              <div className="feature-card">
                <span className="feature-icon">📍</span>
                <h3>Pattern Modes</h3>
                <p>Full Scale, 3 Notes Per String (3NPS), CAGED positions, and Diagonal patterns to master the fretboard systematically.</p>
              </div>
              <div className="feature-card">
                <span className="feature-icon">⚖️</span>
                <h3>Scale Comparison</h3>
                <p>Compare two scales side by side or overlaid on a single fretboard to see overlapping notes and differences.</p>
              </div>
              <div className="feature-card">
                <span className="feature-icon">🎼</span>
                <h3>Chord Progressions</h3>
                <p>View diatonic chord progressions in any key with dominant scale suggestions for songwriting and improvisation.</p>
              </div>
              <div className="feature-card">
                <span className="feature-icon">🎤</span>
                <h3>Built-in Tuner</h3>
                <p>Chromatic tuner with real-time pitch detection and a cents meter — no extra app needed.</p>
              </div>
              <div className="feature-card">
                <span className="feature-icon">🥁</span>
                <h3>Metronome</h3>
                <p>Adjustable BPM with multiple time signatures (3/4, 4/4, 5/4, 6/8, 7/8) and tempo presets for structured practice.</p>
              </div>
              <div className="feature-card">
                <span className="feature-icon">🎧</span>
                <h3>Backing Track Generator</h3>
                <p>Create chord progressions, set tempo and time signature, then jam with loop and preset progression support.</p>
              </div>
              <div className="feature-card">
                <span className="feature-icon">📥</span>
                <h3>Export as PNG</h3>
                <p>Download fretboard diagrams as transparent overlay images or full fretboard graphics for video or print.</p>
              </div>
            </div>
          </section>

          <section className="static-section">
            <h2>About NIXX Music</h2>
            <p>
              NIXX Music is a music-focused creative studio dedicated to building tools and resources that
              help musicians learn, practice, and create. FretWiki is our flagship project — built by
              musicians, for musicians.
            </p>
          </section>

          <section className="static-section">
            <h2>Contact</h2>
            <p>
              Have feedback, feature requests, or found a bug? We&apos;d love to hear from you.
              Reach out to us through our social media channels or drop us an email.
            </p>
          </section>

          <footer className="static-footer">
            <p>&copy; {new Date().getFullYear()} NIXX Music. All rights reserved.</p>
            <div className="static-footer-links">
              <Link href="/">Home</Link>
              <Link href="/terms">Terms &amp; Conditions</Link>
            </div>
          </footer>
        </div>
      </div>
    </>
  )
}
