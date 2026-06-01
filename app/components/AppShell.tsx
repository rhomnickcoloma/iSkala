'use client'

import Fretboard from './Fretboard'
import Header from './Header'
import CompareButton from './CompareButton'
import TunerButton from './TunerButton'
import BackingTrackButton from './BackingTrackButton'
import InstrumentSelector from './InstrumentSelector'
import VersionInfo from './VersionInfo'

export default function AppShell() {
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

      <div className="container">
        <Header />
        <main>
          <Fretboard />
        </main>
      </div>

      <div className="floating-buttons">
        <CompareButton />
        <TunerButton />
        <BackingTrackButton />
      </div>

      <InstrumentSelector />
      <VersionInfo />
    </>
  )
}
