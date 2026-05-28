export default function Header() {
  return (
    <header>
      <div className="header-content">
        <div className="brand">
          <img src="/nixx-logo.PNG" alt="FretWiki Logo" className="brand-logo" />
          <div className="brand-text">
            <span className="brand-name">FretWiki</span>
            <span className="brand-sub">By NIXX Music</span>
          </div>
        </div>
        <div className="header-title">
          <h1>🎸 Guitar Scale Reference</h1>
          <p className="subtitle">Interactive fretboard to learn scales in any key</p>
        </div>
        <div className="header-spacer"></div>
      </div>
    </header>
  )
}
