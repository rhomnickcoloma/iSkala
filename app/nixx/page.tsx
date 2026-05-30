import { InstrumentProvider } from '../context/InstrumentContext'
import Fretboard from '../components/Fretboard'
import Header from '../components/Header'
import BackingTrackGenerator from '../components/BackingTrackGenerator'
import CompareButton from '../components/CompareButton'
import TunerButton from '../components/TunerButton'
import InstrumentSelector from '../components/InstrumentSelector'
import VersionInfo from '../components/VersionInfo'

export default function NixxPage() {
  return (
    <InstrumentProvider>
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
        <BackingTrackGenerator />
      </div>

      <InstrumentSelector />
      <VersionInfo />
    </InstrumentProvider>
  )
}
