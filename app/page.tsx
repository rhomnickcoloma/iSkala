import { InstrumentProvider } from './context/InstrumentContext'
import AppShell from './components/AppShell'

export default function Home() {
  return (
    <InstrumentProvider>
      <AppShell />
    </InstrumentProvider>
  )
}
