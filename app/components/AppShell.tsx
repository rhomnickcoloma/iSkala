'use client'

import Fretboard from './Fretboard'
import PageTitle, { InstrumentSwitch } from './PageTitle'
import CompareButton from './CompareButton'
import BackingTrackButton from './BackingTrackButton'
import VersionInfo from './VersionInfo'
import { useInstrument } from '../context/InstrumentContext'
import { Icon } from './Icons'
import BgDecoration from './BgDecoration'

export default function AppShell() {
  const { instrument } = useInstrument()

  return (
    <>
      <BgDecoration />

      <div className="container">
        <PageTitle
          icon={<Icon name={instrument.icon} size="0.9em" className="inline-icon" />}
          title={`${instrument.name} Scale Reference`}
          subtitle="Interactive fretboard to learn scales in any key"
          action={<InstrumentSwitch />}
        />
        <main>
          <Fretboard />
        </main>
      </div>

      <div className="floating-buttons">
        <CompareButton />
        <BackingTrackButton />
      </div>

      <VersionInfo />
    </>
  )
}
