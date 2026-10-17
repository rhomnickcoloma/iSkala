import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  alternates: { canonical: '/terms' },
  title: 'Terms & Conditions',
  description: 'Terms and Conditions for using FretWiki by NIXX Music.',
}

export default function TermsPage() {
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
        <nav className="static-nav">
          <Link href="/" className="back-link">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            Back to FretWiki
          </Link>
        </nav>

        <div className="static-content">
          <div className="static-hero">
            <h1>Terms &amp; Conditions</h1>
            <p className="static-tagline">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>

          <section className="static-section">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using FretWiki (&quot;the Application&quot;), a product of NIXX Music (&quot;we&quot;,
              &quot;us&quot;, or &quot;our&quot;), you agree to be bound by these Terms and Conditions. If you do not
              agree to these terms, please do not use the Application.
            </p>
          </section>

          <section className="static-section">
            <h2>2. Description of Service</h2>
            <p>
              FretWiki is a free, web-based interactive fretboard reference tool that provides scale
              visualization, a metronome, a chromatic tuner, backing track generation, scale comparison,
              chord progression views, and fretboard diagram export features for guitar, bass, and
              ukulele players.
            </p>
          </section>

          <section className="static-section">
            <h2>3. Free Use</h2>
            <p>
              FretWiki is provided free of charge. We reserve the right to introduce premium features,
              subscriptions, or other paid services in the future, at which point updated terms will be
              provided. Core functionality will remain free.
            </p>
          </section>

          <section className="static-section">
            <h2>4. Intellectual Property</h2>
            <p>
              All content, design, graphics, user interface, code, and other materials on FretWiki are
              owned by or licensed to NIXX Music and are protected by applicable intellectual property
              laws. You may not reproduce, distribute, modify, or create derivative works from the
              Application without our prior written consent.
            </p>
            <p>
              Fretboard diagrams exported using the download feature are provided for your personal,
              non-commercial use. You may use exported images in your own educational content, social
              media posts, or practice materials, provided you credit FretWiki / NIXX Music where
              reasonable.
            </p>
          </section>

          <section className="static-section">
            <h2>5. User Conduct</h2>
            <p>You agree not to:</p>
            <ul>
              <li>Use the Application for any unlawful purpose or in violation of any applicable laws.</li>
              <li>Attempt to gain unauthorized access to any part of the Application or its systems.</li>
              <li>Interfere with or disrupt the operation of the Application.</li>
              <li>Scrape, crawl, or use automated tools to extract data from the Application beyond normal use.</li>
              <li>Remove, alter, or obscure any copyright or proprietary notices.</li>
            </ul>
          </section>

          <section className="static-section">
            <h2>6. Microphone Access</h2>
            <p>
              The tuner, effects, and FretWiki AI features may request access to your device&apos;s
              microphone. Microphone audio is processed in your browser for pitch detection and is not
              stored or uploaded by default. FretWiki AI does not send raw recordings to a server.
            </p>
            <p>
              If a site operator configures an optional LLM API key, FretWiki AI may send structured
              analysis (detected note names, entered chords, inferred key, and similar text) to that
              provider to generate coaching. You can use FretWiki AI without this; the on-device theory
              coach still works.
            </p>
          </section>

          <section className="static-section" id="privacy">
            <h2>7. Accounts, Privacy &amp; Data Collection</h2>
            <p>
              Every FretWiki tool can be used without an account. Accounts are optional and exist only
              to save things such as effects patches.
            </p>
            <p>
              <strong>Without an account.</strong> Anything you save while signed out stays in your browser&apos;s
              local storage on your device and is never sent to our servers. Clearing your browser data
              removes it.
            </p>
            <p>
              <strong>Google or Facebook sign-in.</strong> If you sign in, we receive your name, email address and
              profile picture from the provider you choose. We use them only to identify your account and
              show who is signed in. Patches saved in your browser are moved into your account when you sign in. We never post
              on your behalf or access your contacts.
            </p>
            <p>
              Saved data is stored with our database provider, Supabase. The Application may also use
              anonymous analytics (such as Vercel Analytics) to understand usage patterns; these do not
              collect personally identifiable information. Preferences such as the selected key, scale and
              instrument stay in your browser.
            </p>
          </section>

          <section className="static-section" id="data-deletion">
            <h2>7a. Deleting Your Data</h2>
            <p>
              To delete your account and everything saved to it, sign in, open the account menu (your
              profile picture in the top right) and choose <strong>Delete account</strong>. Deletion is immediate
              and permanent. If you can no longer sign in, contact us using the details below and we will
              delete your data within 30 days. Data saved without an account lives only in your browser and
              is removed by clearing your browser data.
            </p>
          </section>

          <section className="static-section">
            <h2>8. Cookies</h2>
            <p>
              FretWiki may use essential cookies or local storage to remember your preferences and
              improve your experience. No tracking cookies from third-party advertisers are used.
            </p>
          </section>

          <section className="static-section">
            <h2>9. Disclaimer of Warranties</h2>
            <p>
              FretWiki is provided &quot;as is&quot; and &quot;as available&quot; without warranties of any kind, either
              express or implied. We do not guarantee that the Application will be uninterrupted,
              error-free, or free of harmful components. Musical information provided (scales, intervals,
              chord progressions) is for educational reference only.
            </p>
          </section>

          <section className="static-section">
            <h2>10. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, NIXX Music shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages arising from your use of or
              inability to use the Application. Our total liability for any claim related to the
              Application shall not exceed the amount you paid to use it (which is zero for the free
              version).
            </p>
          </section>

          <section className="static-section">
            <h2>11. Third-Party Services</h2>
            <p>
              The Application may include integrations with third-party services (e.g., Vercel for
              hosting and analytics, Supabase for accounts and saved data, and Google or Facebook for
              sign-in). Your use of such third-party services is subject to their
              respective terms and privacy policies. We are not responsible for the practices of
              third-party service providers.
            </p>
          </section>

          <section className="static-section">
            <h2>12. Modifications to Terms</h2>
            <p>
              We reserve the right to update or modify these Terms and Conditions at any time. Changes
              will be effective immediately upon posting to the Application. Your continued use of
              FretWiki after any changes constitutes your acceptance of the updated terms. We encourage
              you to review these terms periodically.
            </p>
          </section>

          <section className="static-section">
            <h2>13. Termination</h2>
            <p>
              We reserve the right to restrict or terminate access to the Application at our sole
              discretion, without notice, for conduct that we believe violates these Terms or is
              harmful to other users or the Application.
            </p>
          </section>

          <section className="static-section">
            <h2>14. Governing Law</h2>
            <p>
              These Terms and Conditions shall be governed by and construed in accordance with the
              laws of the Republic of the Philippines, without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="static-section">
            <h2>15. Contact Information</h2>
            <p>
              If you have any questions about these Terms and Conditions, please contact us through
              our social media channels or reach out to NIXX Music directly.
            </p>
          </section>

          <footer className="static-footer">
            <p>&copy; {new Date().getFullYear()} NIXX Music. All rights reserved.</p>
            <div className="static-footer-links">
              <Link href="/">Home</Link>
              <Link href="/about">About Us</Link>
            </div>
          </footer>
        </div>
      </div>
    </>
  )
}
