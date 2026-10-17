'use client'

import type { ReactNode } from 'react'
import { useInstrument } from '../context/InstrumentContext'
import { Icon } from './Icons'

export function InstrumentSwitch() {
  const { instrument, setShowSelector } = useInstrument()
  return (
    <button className="instrument-switch-btn" onClick={() => setShowSelector(true)} title="Change instrument">
      <Icon name={instrument.icon} size={16} />
      <span className="instrument-switch-label">{instrument.name}</span>
      <Icon name="chevron-down" size={14} />
    </button>
  )
}

// Slim page title bar shared by the scale, compare and backing track pages
export default function PageTitle({ icon, title, subtitle, action }: { icon?: ReactNode; title: string; subtitle: string; action?: ReactNode }) {
  return (
    <section className="page-title">
      <h1>{icon}{title}</h1>
      <p className="subtitle">{subtitle}</p>
      {action}
    </section>
  )
}
