import Fretboard from './components/Fretboard'
import Header from './components/Header'
import BackingTrackGenerator from './components/BackingTrackGenerator'

export default function Home() {
  return (
    <>
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
    </>
  )
}
