import Image from "next/image";

const faqItems = [
  {
    question: "Does Cronye run in the cloud?",
    answer:
      "No. Cronye runs entirely on your local machine with a persistent localhost API and secure local storage."
  },
  {
    question: "Does my machine need to stay on?",
    answer:
      "Yes. Just like a standard cron daemon, jobs execute only while your machine and the Cronye service are running."
  },
  {
    question: "Which operating systems are supported?",
    answer:
      "Cronye provides native service installation for macOS, Linux, and Windows."
  },
  {
    question: "What does the $39 lifetime plan include?",
    answer:
      "A perpetual license for the Cronye automation engine, including shell/webhook jobs, retries, logs, and advanced cleanup controls."
  },
  {
    question: "Is telemetry enabled by default?",
    answer:
      "Absolutely not. Cronye respect your privacy; no telemetry is gathered or sent by default."
  }
];

const featureCards = [
  {
    title: "Cron Scheduling",
    body: "Strict cron validation with timezone-aware execution and sub-second precision. Supports standard crontab syntax and common intervals.",
    size: ""
  },
  {
    title: "Retries + Alerts",
    body: "Exponential backoff with jitter and automated failure webhooks. Ensure your critical jobs never stay failed without you knowing.",
    size: ""
  },
  {
    title: "Full Run Logs",
    body: "Detailed history with exit codes, duration tracking, and full output capture. Every execution is audited and searchable.",
    size: "bento-card-wide"
  },
  {
    title: "Auto Cleanup",
    body: "Automated retention windows and log caps. Keep your local machine clean by setting execution history limits.",
    size: ""
  }
];

const useCases = [
  {
    title: "Database Backups",
    description: "Schedule PostgreSQL or MySQL dumps to local or network storage without exposing credentials to third-party cloud tools.",
    icon: "🗄️"
  },
  {
    title: "Log Rotation",
    description: "Keep your application logs in check with automated gzipping and rotation scripts running on a strict schedule.",
    icon: "📜"
  },
  {
    title: "System Health Checks",
    description: "Run periodic shell scripts to monitor disk usage, memory pressure, or network connectivity and alert via webhook.",
    icon: "📟"
  }
];

export default function HomePage() {
  return (
    <main>
      <header className="topbar">
        <div className="container topbar-inner">
          <div className="brand-wrapper">
            <Image 
              src="/branding/mascot.png" 
              alt="Cronye Mascot" 
              width={28} 
              height={28} 
              className="mascot-thumb"
            />
            <p className="brand">Cronye</p>
          </div>
          <nav className="top-links" aria-label="Primary">
            <a href="#how-it-works">How It Works</a>
            <a href="#showcase">Showcase</a>
            <a href="#features">Features</a>
            <a href="#use-cases">Use Cases</a>
            <a href="#pricing">Pricing</a>
            <a href="/checkout" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Get Started</a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="container">
          <div className="hero-mascot-container">
            <Image 
              src="/branding/mascot.png" 
              alt="Cronye Mascot" 
              width={120} 
              height={120} 
              className="hero-mascot"
              priority
            />
          </div>
          <h1>Reliable automation on your own machine.</h1>
          <p className="lead">
            A professional grade local-first cron daemon and webhook runner. 
            Built for reliability, privacy, and absolute control over your infrastructure.
          </p>
          <div className="cta-row">
            <a className="btn btn-primary" href="/checkout">
              Get Lifetime Access — $39
            </a>
            <a className="btn btn-secondary" href="#features">
              Explore Documentation
            </a>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="section">
        <div className="container">
          <h2>Engineering Architecture</h2>
          <div className="diagram-placeholder">
            <div style={{ padding: '2.5rem', border: '1px solid var(--border-subtle)', borderRadius: '12px', background: '#0d1117', color: '#f0f6fc', textAlign: 'left', overflowX: 'auto' }}>
              <p style={{ color: 'var(--accent-amber)', marginBottom: '1rem', fontWeight: 600 }}>// Local Execution Flow</p>
              <pre style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>
                <code>
{`[ USER INTERFACE ]   [ CLI TOOLS ]
       |                 |
       v                 v
[ LOCALHOST API (Cronye Daemon) ] <--- [ SQLITE STATE ]
       |
       +--- [ SHELL EXECUTOR ] ---> [ SYSTEM BINARIES ]
       |
       +--- [ HTTP RUNNER ]    ---> [ EXTERNAL WEBHOOKS ]
       |
       v
[ STRUCTURED LOGS (JSON) ]`}
                </code>
              </pre>
            </div>
            <p style={{ marginTop: '2.5rem', color: 'var(--fg-muted)' }}>Cronye operates as a persistent native service, ensuring task continuity without cloud dependency.</p>
          </div>
        </div>
      </section>

      <section id="showcase" className="section">
        <div className="container">
          <h2>Visual Showcase</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem', marginTop: '4rem' }}>
            <div className="bento-card" style={{ padding: '1rem', justifyContent: 'flex-start' }}>
              <div style={{ marginBottom: '1.5rem', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                <Image 
                  src="/showcase/dashboard.png" 
                  alt="Cronye Dashboard Mockup" 
                  width={600} 
                  height={400} 
                  layout="responsive"
                />
              </div>
              <h3>Administrative Dashboard</h3>
              <p>Monitor all active jobs, success rates, and execution schedules from a clean, unified interface.</p>
            </div>
            <div className="bento-card" style={{ padding: '1rem', justifyContent: 'flex-start' }}>
              <div style={{ marginBottom: '1.5rem', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                <Image 
                  src="/showcase/terminal.png" 
                  alt="Cronye Terminal Interface" 
                  width={600} 
                  height={400} 
                  layout="responsive"
                />
              </div>
              <h3>Terminal Integration</h3>
              <p>Professional shell output capture with real-time logging and exit code validation.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="section">
        <div className="container">
          <h2>Core Features</h2>
          <div className="bento-grid">
            {featureCards.map((feature) => (
              <article key={feature.title} className={`bento-card ${feature.size}`}>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container" style={{ textAlign: 'center' }}>
          <h2>Privacy by Design</h2>
          <div className="bento-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="bento-card" style={{ textAlign: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🛡️</div>
              <h3>No Cloud Sync</h3>
              <p>Your data stays on your hardware. We never see your scripts or logs.</p>
            </div>
            <div className="bento-card" style={{ textAlign: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🕵️</div>
              <h3>Zero Telemetry</h3>
              <p>No tracking, no "usage reporting," no pings home. Ever.</p>
            </div>
            <div className="bento-card" style={{ textAlign: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>💾</div>
              <h3>SQLite Storage</h3>
              <p>Predictable, file-based storage that you own and can backup easily.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="use-cases" className="section">
        <div className="container">
          <h2>Common Use Cases</h2>
          <div className="bento-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {useCases.map((useCase) => (
              <article key={useCase.title} className="bento-card">
                <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{useCase.icon}</div>
                <h3>{useCase.title}</h3>
                <p>{useCase.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="section" style={{ borderBottom: 'none' }}>
        <div className="container">
          <h2>Simple, Transparent Pricing</h2>
          <div className="pricing-wrapper">
            <article className="price-card">
              <span className="price">$39</span>
              <span className="price-sub">Lifetime License • All Features Included</span>
              <ul className="price-list" style={{ marginBottom: '3rem' }}>
                <li>✓ Native macOS/Linux/Windows Binaries</li>
                <li>✓ Local Daemon + Web Interface</li>
                <li>✓ Shell Script Execution Engine</li>
                <li>✓ Advanced Retry & Error Handling</li>
                <li>✓ Professional Run History & Auditing</li>
                <li>✓ Zero External Dependencies</li>
                <li>✓ 100% Privacy - No Telemetry</li>
              </ul>
              <a className="btn btn-primary" href="/checkout" style={{ width: '100%', display: 'inline-block' }}>
                Buy Now
              </a>
            </article>
          </div>
        </div>
      </section>

      <section id="faq" className="section" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="container">
          <h2>Common Questions</h2>
          <div className="faq-list">
            {faqItems.map((faq) => (
              <details key={faq.question}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer>
        <div className="container">
          <p>&copy; {new Date().getFullYear()} Cronye. Engineered for reliability. Local-first, always.</p>
        </div>
      </footer>
    </main>
  );
}
