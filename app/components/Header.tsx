export default function Header() {
  return (
    <header>
      <div className="header-content">
        <div className="brand">
          <img src="/nixx-logo.PNG" alt="iSkala Logo" className="brand-logo" />
          <span className="brand-name">iSkala</span>
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
