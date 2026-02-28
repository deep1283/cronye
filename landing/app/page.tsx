const faqItems = [
  {
    question: "Does Cronye run in the cloud?",
    answer:
      "No. Cronye runs on your machine with a localhost API and local storage."
  },
  {
    question: "Does my machine need to stay on?",
    answer:
      "Yes. Jobs run only while your machine and Cronye daemon are running."
  },
  {
    question: "Which operating systems are supported?",
    answer:
      "MVP targets macOS, Linux, and Windows with native service installation."
  },
  {
    question: "What does the $39 lifetime plan include?",
    answer:
      "A one-time license for the cron product with shell/webhook jobs, retries, logs, and cleanup controls."
  },
  {
    question: "Is telemetry enabled by default?",
    answer:
      "No. MVP ships with telemetry off by default."
  },
  {
    question: "Can I run AI agents in this version?",
    answer:
      "Not in MVP. AI add-on functionality is planned for later versions."
  }
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqItems.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer
    }
  }))
};

const featureCards = [
  {
    title: "Cron Scheduling",
    body: "Create, pause, resume, and run jobs now with strict cron validation and timezone selection."
  },
  {
    title: "Retries + Alerts",
    body: "Exponential backoff with jitter, terminal failure webhooks, and clear run state transitions."
  },
  {
    title: "Run Logs",
    body: "Run history with status, duration, exit code, output tail, and failed-run full output capture."
  },
  {
    title: "Cleanup Controls",
    body: "Retention windows, log caps, purge actions, orphan cleanup, and maintenance vacuum cycles."
  }
];

export default function HomePage() {
  return (
    <main className="landing">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <header className="topbar">
        <div className="container topbar-inner">
          <p className="brand">Cronye</p>
          <nav className="top-links" aria-label="Primary">
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="container hero-inner">
          <p className="eyebrow">Local-first automation runtime</p>
          <h1>Reliable automations on your own machine.</h1>
          <p className="lead">
            Shell and webhook jobs with retries, run logs, and retention controls.
            No cloud lock-in. No remote runtime.
          </p>
          <div className="cta-row">
            <a className="btn btn-primary" href="#pricing">
              Buy for $39
            </a>
            <a className="btn btn-secondary" href="#waitlist">
              Join waitlist
            </a>
          </div>
          <div className="hero-metrics">
            <p>Idle RAM target: &lt; 80 MB</p>
            <p>Idle CPU target: &lt; 1%</p>
            <p>Startup target: &lt; 2s</p>
          </div>
        </div>
      </section>

      <section id="features" className="section">
        <div className="container">
          <h2>Built for dependable local automation</h2>
          <div className="card-grid">
            {featureCards.map((feature) => (
              <article key={feature.title} className="card">
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section perf">
        <div className="container">
          <h2>Performance by default</h2>
          <div className="perf-grid">
            <article>
              <p className="metric">Under 100 MB / month</p>
              <p>Default capped disk growth with retention and cleanup controls.</p>
            </article>
            <article>
              <p className="metric">Overlap policy: skip</p>
              <p>Safe default prevents accidental concurrent execution storms.</p>
            </article>
            <article>
              <p className="metric">Global concurrency: 1</p>
              <p>Predictable MVP execution model, configurable up to 2 workers.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="pricing" className="section pricing">
        <div className="container">
          <h2>Simple launch pricing</h2>
          <article className="price-card">
            <p className="price">$39</p>
            <p className="price-sub">one-time lifetime plan (cron product only)</p>
            <ul className="price-list">
              <li>Local daemon + local web UI</li>
              <li>Cron jobs for shell and HTTP</li>
              <li>Retries, logging, retention, and purge controls</li>
              <li>No telemetry by default</li>
            </ul>
            <a className="btn btn-primary" href="#">
              Buy now
            </a>
          </article>
        </div>
      </section>

      <section id="faq" className="section">
        <div className="container">
          <h2>FAQ</h2>
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

      <section id="waitlist" className="section final-cta">
        <div className="container">
          <h2>Run automations locally with confidence</h2>
          <p>
            Get launch onboarding, setup docs, and direct support for early users.
          </p>
          <div className="cta-row">
            <a className="btn btn-primary" href="#">
              Buy for $39
            </a>
            <a className="btn btn-secondary" href="mailto:hello@cronye.app">
              Join waitlist
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
