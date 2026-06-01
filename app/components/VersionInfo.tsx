'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Release {
  version: string
  date: string
  title: string
  changes: string[]
}

export default function VersionInfo() {
  const [showChangelog, setShowChangelog] = useState(false)
  const [changelog, setChangelog] = useState<Release[]>([])

  useEffect(() => {
    fetch('/changelog.json')
      .then(res => res.json())
      .then((data: Release[]) => setChangelog(data))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!showChangelog) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowChangelog(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showChangelog])

  const latestVersion = changelog[0]?.version ?? '...'

  return (
    <>
      <footer className="version-footer">
        <div className="version-links">
          <Link href="/about" className="version-link">About</Link>
          <span className="version-sep">·</span>
          <Link href="/terms" className="version-link">Terms</Link>
          <span className="version-sep">·</span>
          <button className="version-btn" onClick={() => setShowChangelog(true)}>
            v{latestVersion}
          </button>
        </div>
      </footer>

      {showChangelog && (
        <div className="changelog-overlay" onClick={() => setShowChangelog(false)}>
          <div className="changelog-modal" onClick={e => e.stopPropagation()}>
            <div className="changelog-header">
              <h2>What&apos;s New</h2>
              <button className="changelog-close-btn" onClick={() => setShowChangelog(false)}>✕</button>
            </div>

            <div className="changelog-body">
              {changelog.map((release, i) => (
                <div key={release.version} className={`changelog-release ${i === 0 ? 'latest' : ''}`}>
                  <div className="changelog-release-header">
                    <span className="changelog-version">v{release.version}</span>
                    {i === 0 && <span className="changelog-badge">Latest</span>}
                    <span className="changelog-date">{release.date}</span>
                  </div>
                  <h3 className="changelog-title">{release.title}</h3>
                  <ul className="changelog-list">
                    {release.changes.map((change, j) => (
                      <li key={j}>{change}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
