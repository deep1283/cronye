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

type FounderBenefit = {
  title: string;
  body: string;
  icon: "cost" | "speed" | "focus";
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

const founderBenefits: FounderBenefit[] = [
  {
    title: "Save Early Cash",
    body: "Run automations locally while validating your product before paying for managed scheduler infrastructure.",
    icon: "cost"
  },
  {
    title: "Ship Faster",
    body: "Test new jobs and product flows instantly on your machine without waiting on cloud setup.",
    icon: "speed"
  },
  {
    title: "Stay In Control",
    body: "Your runs and logs stay on your own system, so iteration is private and predictable.",
    icon: "focus"
  }
];

const downloadOptions: DownloadOption[] = [
  {
    os: "macOS",
    note: "Works on all modern Macs",
    href: process.env.NEXT_PUBLIC_DOWNLOAD_URL_MAC?.trim() || "/api/download/macos"
  },
  {
    os: "Windows",
    note: "Works on Windows 10 and newer",
    href: process.env.NEXT_PUBLIC_DOWNLOAD_URL_WINDOWS?.trim() || "/api/download/windows"
  },
  {
    os: "Linux",
    note: "Works on major Linux versions",
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

function FounderIcon({ icon, className }: Readonly<{ icon: FounderBenefit["icon"]; className?: string }>) {
  if (icon === "cost") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 7.8V16.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14.8 9.6C14.2 8.8 13.3 8.4 12 8.4C10.5 8.4 9.5 9.1 9.5 10.2C9.5 11.2 10.2 11.8 11.8 12.2L12.9 12.5C14.2 12.8 14.9 13.4 14.9 14.3C14.9 15.4 13.8 16.1 12 16.1C10.5 16.1 9.4 15.6 8.8 14.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }

  if (icon === "speed") {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
        <path d="M12 4.2L6.2 12H11L10.2 19.8L17.8 10.8H13L12 4.2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 3.8L18.2 6.2V11.2C18.2 15.2 15.8 18.8 12 20.2C8.2 18.8 5.8 15.2 5.8 11.2V6.2L12 3.8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9.2 12L11.3 14.1L14.8 10.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function OSIcon({ os, className }: Readonly<{ os: DownloadOption["os"]; className?: string }>) {
  const iconSrc: Record<DownloadOption["os"], string> = {
    macOS: "/branding/apple-brand.svg",
    Windows: "/branding/windows-brand.svg",
    Linux: "/branding/linux-brand.svg"
  };

  return <Image src={iconSrc[os]} alt={`${os} icon`} width={20} height={20} className={className} />;
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

      <section className="section section-alt founder-section">
        <div className="container">
          <FadeIn>
            <p className="eyebrow">For indie hackers and founders</p>
            <h2>Test automation before paying for extra infrastructure</h2>
            <p className="section-lead">
              Validate cron-powered workflows on your own machine first, then scale up only when your product needs it.
            </p>
          </FadeIn>

          <div className="founder-grid">
            {founderBenefits.map((item, idx) => (
              <FadeIn key={item.title} delay={idx * 0.05}>
                <article className="founder-card">
                  <span className="icon-chip">
                    <FounderIcon icon={item.icon} className="icon" />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
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
