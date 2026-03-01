"use client";

import Image from "next/image";
import { motion } from "motion/react";
import type { ReactNode, SVGProps } from "react";

type Feature = {
  title: string;
  body: string;
  icon: "bolt" | "db" | "alert";
};

type Faq = {
  q: string;
  a: string;
};

type DownloadOption = {
  os: "macOS" | "Windows" | "Linux";
  note: string;
  href: string;
};

const features: Feature[] = [
  {
    title: "Reliable Execution",
    body: "Shell and HTTP jobs with per-job timeout, retries, and overlap policy.",
    icon: "bolt"
  },
  {
    title: "SQLite History",
    body: "Every run is persisted locally with status transitions, exit code, duration, and output tail.",
    icon: "db"
  },
  {
    title: "Failure Alerting",
    body: "Send terminal failure notifications to your webhook endpoint with contextual run metadata.",
    icon: "alert"
  }
];

const faqItems: Faq[] = [
  {
    q: "Is Cronye cloud-hosted?",
    a: "No. Cronye runs locally on your machine and exposes local UI/API over localhost."
  },
  {
    q: "Will jobs run while my computer is off?",
    a: "No. Jobs run when the daemon is running. On restart, startup catch-up can replay missed windows."
  },
  {
    q: "What does the $9 plan include?",
    a: "Lifetime access to the local cron product: scheduler, retries, logs, retention, and cleanup controls."
  },
  {
    q: "Can I use shell and HTTP jobs together?",
    a: "Yes. You can create shell jobs and HTTP request jobs from the same local dashboard."
  }
];

const downloadOptions: DownloadOption[] = [
  {
    os: "macOS",
    note: "Apple Silicon and Intel builds",
    href: process.env.NEXT_PUBLIC_DOWNLOAD_URL_MAC?.trim() || "/api/download/macos"
  },
  {
    os: "Windows",
    note: "x64 executable release bundle",
    href: process.env.NEXT_PUBLIC_DOWNLOAD_URL_WINDOWS?.trim() || "/api/download/windows"
  },
  {
    os: "Linux",
    note: "systemd-ready daemon bundle",
    href: process.env.NEXT_PUBLIC_DOWNLOAD_URL_LINUX?.trim() || "/api/download/linux"
  }
];

function FadeIn({
  children,
  delay = 0
}: Readonly<{
  children: ReactNode;
  delay?: number;
}>) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

function BoltIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M13 2L4 14H11L10 22L20 9H13V2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function DbIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <ellipse cx="12" cy="6" rx="7" ry="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 6V17C5 18.7 8.1 20 12 20C15.9 20 19 18.7 19 17V6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 11C5 12.7 8.1 14 12 14C15.9 14 19 12.7 19 11" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function AlertIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 3L20 18H4L12 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 9V13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

function FeatureIcon({ icon, className }: Readonly<{ icon: Feature["icon"]; className?: string }>) {
  if (icon === "bolt") return <BoltIcon className={className} />;
  if (icon === "db") return <DbIcon className={className} />;
  return <AlertIcon className={className} />;
}

function OSIcon({ os, className }: Readonly<{ os: DownloadOption["os"]; className?: string }>) {
  if (os === "macOS") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <path
          d="M15.7 7.3C16.7 6.1 17.1 4.9 17 3.7C15.5 3.8 14.1 4.6 13.2 5.8C12.4 6.8 11.8 8.1 11.9 9.3C13.4 9.4 14.8 8.5 15.7 7.3Z"
          fill="currentColor"
        />
        <path
          d="M20.3 16.8C19.9 17.8 19.3 18.8 18.6 19.7C17.6 21 16.5 22.3 14.9 22.3C13.6 22.3 13.2 21.5 11.7 21.5C10.2 21.5 9.7 22.3 8.4 22.3C6.8 22.3 5.8 21.1 4.8 19.8C2.6 16.9 1 12.1 3.3 8.5C4.4 6.8 6.3 5.7 8.1 5.7C9.5 5.7 10.8 6.6 11.7 6.6C12.5 6.6 14.1 5.5 15.8 5.6C16.5 5.6 18.4 5.8 19.7 7.7C19.6 7.8 17.5 9 17.6 11.6C17.6 14.7 20.2 16.6 20.3 16.8Z"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (os === "Windows") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <path d="M3 4.8L10.8 3.7V11H3V4.8Z" fill="currentColor" />
        <path d="M12.2 3.5L21 2.3V11H12.2V3.5Z" fill="currentColor" />
        <path d="M3 12.8H10.8V20.2L3 19.1V12.8Z" fill="currentColor" />
        <path d="M12.2 12.8H21V21.6L12.2 20.3V12.8Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8.6 11.2C8.9 8.7 10.2 7 12 7C13.8 7 15.1 8.7 15.4 11.2C15.1 11.6 14.7 11.8 14.2 11.8H9.8C9.3 11.8 8.9 11.6 8.6 11.2Z"
        fill="currentColor"
      />
      <path d="M9.5 14.3C10.1 15 11 15.4 12 15.4C13 15.4 13.9 15 14.5 14.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="9.8" cy="11.9" r="0.7" fill="currentColor" />
      <circle cx="14.2" cy="11.9" r="0.7" fill="currentColor" />
    </svg>
  );
}

export default function HomePage() {
  const currentYear = new Date().getFullYear();
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a
      }
    }))
  };

  return (
    <main className="landing-shell">
      <div className="bg-layer bg-solid" aria-hidden="true" />
      <div className="bg-layer bg-radial" aria-hidden="true" />
      <div className="bg-layer bg-grid" aria-hidden="true" />

      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <header className="site-nav">
        <div className="container nav-inner">
          <a className="brand" href="#top">
            <span className="brand-icon-wrap">
              <Image
                src="/branding/mascot.png"
                alt="Cronye mascot logo"
                width={24}
                height={24}
                className="brand-icon-image"
              />
            </span>
            <span>Cronye</span>
          </a>

          <nav className="nav-links" aria-label="Primary">
            <a href="#features">Features</a>
            <a href="#docs">Docs</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>

          <a className="btn btn-subtle btn-compact" href="#download">
            Download
          </a>
        </div>
      </header>

      <section id="top" className="hero-section">
        <div className="container hero-grid">
          <FadeIn>
            <div className="hero-copy">
              <h1>
                Automate <span>locally</span>, run reliably.
              </h1>
              <p className="hero-lead">
                Local-first cron automation daemon built in Go, with deterministic scheduling, structured logs,
                retries, and retention controls.
              </p>

              <div className="hero-actions">
                <a className="btn btn-primary" href="#download">
                  Download App
                </a>
                <a className="btn btn-subtle" href="/checkout">
                  Buy License
                </a>
                <a className="btn btn-secondary" href="/recover">
                  Recover License
                </a>
              </div>

              <div className="cli-chip" aria-label="Install command">
                <span className="prompt">$</span>
                <code>cd daemon && go run ./cmd/daemon</code>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.06}>
            <div className="hero-visual">
              <div className="liquid-ether" aria-hidden="true">
                <span className="ether-blob ether-a" />
                <span className="ether-blob ether-b" />
                <span className="ether-blob ether-c" />
                <span className="ether-hole" />
              </div>

              <svg className="system-orbit" viewBox="0 0 560 560" fill="none" aria-hidden="true">
                <motion.circle
                  cx="280"
                  cy="280"
                  r="218"
                  className="ring faint"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                />
                <motion.circle
                  cx="280"
                  cy="280"
                  r="170"
                  className="ring"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                />
                <motion.circle
                  cx="280"
                  cy="280"
                  r="118"
                  className="ring faint"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                />

                <motion.path
                  d="M280 214V124"
                  className="link"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.4 }}
                  transition={{ duration: 1.5, delay: 0.5 }}
                />
                <motion.path
                  d="M236 306L154 360"
                  className="link"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.4 }}
                  transition={{ duration: 1.5, delay: 0.7 }}
                />
                <motion.path
                  d="M324 306L406 360"
                  className="link"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.4 }}
                  transition={{ duration: 1.5, delay: 0.9 }}
                />

                <circle cx="280" cy="280" r="76" className="core-shell" />
                <motion.circle
                  cx="280"
                  cy="280"
                  r="10"
                  className="core-dot"
                  animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />

                <motion.g
                  className="node"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.5, delay: 1.2 }}
                >
                  <rect x="244" y="96" width="72" height="46" rx="8" />
                  <text x="280" y="124">
                    SHELL
                  </text>
                </motion.g>
                <motion.g
                  className="node"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.5, delay: 1.4 }}
                >
                  <rect x="116" y="360" width="88" height="46" rx="8" />
                  <text x="160" y="388">
                    HTTP
                  </text>
                </motion.g>
                <motion.g
                  className="node"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.5, delay: 1.6 }}
                >
                  <rect x="356" y="360" width="88" height="46" rx="8" />
                  <text x="400" y="388">
                    SQLITE
                  </text>
                </motion.g>
              </svg>
            </div>
          </FadeIn>
        </div>
      </section>

      <section id="download" className="dashboard-section">
        <div className="container">
          <FadeIn>
            <div>
              <p className="eyebrow">Step 1: Download</p>
              <h2>Download Cronye for your OS</h2>
              <p className="section-lead">
                Install the local runtime first, then purchase a license key to activate access in the app.
              </p>
            </div>
          </FadeIn>

          <div className="download-grid">
            {downloadOptions.map((item, idx) => (
              <FadeIn key={item.os} delay={0.04 + idx * 0.04}>
                <article className="download-card">
                  <div className="download-head">
                    <span className="download-icon-wrap">
                      <OSIcon os={item.os} className="download-icon" />
                    </span>
                    <p className="download-os">{item.os}</p>
                  </div>
                  <p className="download-note">{item.note}</p>
                  <a className="btn btn-primary" href={item.href} target="_blank" rel="noreferrer">
                    Download for {item.os}
                  </a>
                </article>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.16}>
            <p className="download-next">
              Step 2: after installing, purchase your license key on{" "}
              <a href="/checkout">checkout</a> and activate it in the local UI.
            </p>
          </FadeIn>
        </div>
      </section>

      <section id="features" className="section">
        <div className="container">
          <FadeIn>
            <p className="eyebrow">Developer experience first</p>
            <h2>A toolkit for reliable local automation</h2>
            <p className="section-lead">
              Replace fragile `crontab` scripts with a deterministic daemon and a clear run history.
            </p>
          </FadeIn>

          <div className="feature-grid">
            {features.map((feature, idx) => (
              <FadeIn key={feature.title} delay={idx * 0.05}>
                <article className="feature-card">
                  <span className="icon-chip">
                    <FeatureIcon icon={feature.icon} className="icon" />
                  </span>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </article>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section id="docs" className="section section-alt">
        <div className="container docs-shell">
          <FadeIn>
            <p className="eyebrow">Zero-config deployment</p>
            <h2>Start daemon in seconds</h2>
            <p className="section-lead">
              Launch locally, create jobs, and monitor status from the browser on localhost.
            </p>
          </FadeIn>

          <FadeIn delay={0.05}>
            <article className="terminal-card" aria-label="Terminal example">
              <header>
                <span />
                <span />
                <span />
                <p>zsh - 80x24</p>
              </header>
              <pre>
                <code>
{`user@dev:~/cronye$ cd ui && npm run build
user@dev:~/cronye$ cd ../daemon && go run ./cmd/daemon
Initializing Cronye daemon...
✓ Loaded 4 jobs from SQLite
✓ API listening on http://127.0.0.1:9480
✓ Scheduler active (startup catch-up: enabled)`}
                </code>
              </pre>
            </article>
          </FadeIn>
        </div>
      </section>

      <section id="pricing" className="section">
        <div className="container pricing-shell">
          <FadeIn>
              <p className="eyebrow">Simple pricing</p>
              <h2>One-time payment. Own your runtime.</h2>
          </FadeIn>

          <FadeIn delay={0.05}>
            <article className="price-card">
              <p className="price-amount">$9</p>
              <p className="price-sub">Lifetime plan for Cronye local cron product.</p>
              <ul>
                <li>Shell and HTTP jobs</li>
                <li>Retries with backoff and jitter</li>
                <li>Run history and output logs</li>
                <li>Retention and purge controls</li>
                <li>macOS, Linux, Windows support</li>
              </ul>
              <a className="btn btn-primary" href="/checkout">
                Start Checkout
              </a>
            </article>
          </FadeIn>
        </div>
      </section>

      <section id="faq" className="section section-alt">
        <div className="container faq-shell">
          <FadeIn>
            <p className="eyebrow">FAQ</p>
            <h2>Direct answers before you buy</h2>
          </FadeIn>

          <div className="faq-list">
            {faqItems.map((item, idx) => (
              <FadeIn key={item.q} delay={idx * 0.04}>
                <details>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container footer-shell">
          <div className="footer-top">
            <div className="footer-brand-block">
              <a className="brand" href="#top">
                <span className="brand-icon-wrap">
                  <Image
                    src="/branding/mascot.png"
                    alt="Cronye mascot logo"
                    width={24}
                    height={24}
                    className="brand-icon-image"
                  />
                </span>
                <span>Cronye</span>
              </a>
              <p className="footer-tagline">
                Local-first automation for operators who value reliability and privacy.
              </p>
              <div className="footer-social">
                <a
                  className="footer-pill"
                  href="https://x.com/deepmishra1283"
                  target="_blank"
                  rel="noreferrer"
                >
                  Follow on X
                </a>
                <a className="footer-pill" href="mailto:deepmishra1283@gmail.com">
                  Email Support
                </a>
              </div>
            </div>

            <div className="footer-nav-group">
              <p className="footer-label">Product</p>
              <nav className="footer-links" aria-label="Footer product links">
                <a href="#features">Features</a>
                <a href="#docs">Docs</a>
                <a href="#pricing">Pricing</a>
                <a href="#faq">FAQ</a>
                <a href="/checkout">Checkout</a>
              </nav>
            </div>

            <div className="footer-nav-group">
              <p className="footer-label">Company</p>
              <nav className="footer-links" aria-label="Footer company links">
                <a href="/recover">Recover License</a>
                <a href="/privacy">Privacy</a>
                <a href="/terms">Terms</a>
              </nav>
            </div>
          </div>

          <div className="footer-bottom">
            <p>© {currentYear} Cronye</p>
            <p>Runs completely on your own system.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
