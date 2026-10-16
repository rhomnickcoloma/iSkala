import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon, type IconName } from './components/Icons'

export const metadata: Metadata = {
  title: 'Page Not Found',
  robots: { index: false },
}

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: '/', label: 'Scales', icon: 'guitar' },
  { href: '/compare-scales', label: 'Compare Scales', icon: 'scale' },
  { href: '/tuner', label: 'Tuner', icon: 'tuning-fork' },
  { href: '/backing-track', label: 'Backing Track', icon: 'music' },
  { href: '/effects', label: 'Effects', icon: 'sliders-horizontal' },
]

export default function NotFound() {
  return (
    <>
      <div className="bg-decoration">
        <span className="bg-note">♪</span>
        <span className="bg-note">♫</span>
        <span className="bg-note">♩</span>
        <span className="bg-note">♬</span>
        <span className="bg-note">♪</span>
        <span className="bg-note">♫</span>
      </div>

      <div className="container static-page">
        <div className="static-content">
          <div className="static-hero">
            <img src="/logo.png" alt="FretWiki Logo" className="static-logo" />
            <h1>Wrong note!</h1>
            <p className="static-tagline">We couldn&apos;t find that page. Try one of these instead:</p>
          </div>

          <section className="static-section">
            <div className="not-found-links">
              {LINKS.map(link => (
                <Link key={link.href} href={link.href} className="not-found-link">
                  <Icon name={link.icon} size={18} />
                  <span>{link.label}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
