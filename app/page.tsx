import { InstrumentProvider } from './context/InstrumentContext'
import Fretboard from './components/Fretboard'
import Header from './components/Header'
import BackingTrackGenerator from './components/BackingTrackGenerator'
import InstrumentSelector from './components/InstrumentSelector'
import VersionInfo from './components/VersionInfo'

export default function Home() {
  return (
    <InstrumentProvider>
      {/* Background decoration */}
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

      {/* Backing Track Generator - floating button */}
      <BackingTrackGenerator />

      {/* Instrument Selection Popup */}
      <InstrumentSelector />

      {/* Version Footer */}
      <VersionInfo />
    </InstrumentProvider>
  )
}
