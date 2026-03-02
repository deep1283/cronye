"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode, SVGProps } from "react";

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
  os: "macOS";
  note: string;
  href: string;
};

type GettingStartedStep = {
  title: string;
  body: string;
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
    q: "Is Cronye free to use?",
    a: "Yes. Cronye is open source and free to use on your own machine."
  },
  {
    q: "Can I use shell and HTTP jobs together?",
    a: "Yes. You can create shell jobs and HTTP request jobs from the same local dashboard."
  },
  {
    q: "macOS says Cronye cannot be verified. What should I do?",
    a: "Move Cronye to Applications, then open System Settings > Privacy & Security and click Open Anyway for Cronye. If prompted again, right-click Cronye in Applications and choose Open."
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

const gettingStartedSteps: GettingStartedStep[] = [
  {
    title: "Download and install",
    body: "Download Cronye for macOS (Apple Silicon) and install it like a normal desktop app."
  },
  {
    title: "Launch Cronye",
    body: "Open the app from Applications. Cronye runs on your own system and opens the local dashboard."
  },
  {
    title: "If macOS blocks launch",
    body: "Go to System Settings → Privacy & Security, click Open Anyway for Cronye, then open the app again from Applications."
  },
  {
    title: "Create your first automation",
    body: "Add a job, choose when it should run, and enter the action you want Cronye to perform."
  },
  {
    title: "Test and adjust quickly",
    body: "Run a job manually and tweak schedule, retries, and timeout until it behaves the way you want."
  },
  {
    title: "Monitor results anytime",
    body: "Keep Cronye running, then check History to see what ran, what succeeded, and what needs attention."
  }
];

const downloadOptions: DownloadOption[] = [
  {
    os: "macOS",
    note: "Works on Apple Silicon Macs",
    href: process.env.NEXT_PUBLIC_DOWNLOAD_URL_MAC?.trim() || "/api/download/macos"
  }
];

const supportURL = process.env.NEXT_PUBLIC_SUPPORT_URL?.trim() || "/support";
const isSupportExternal =
  supportURL.startsWith("http://") || supportURL.startsWith("https://");

function FadeIn({
  children,
  delay = 0
}: Readonly<{
  children: ReactNode;
  delay?: number;
}>) {
  const style: CSSProperties = {
    animationDelay: `${delay}s`
  };

  return (
    <div className="fade-in" style={style}>
      {children}
    </div>
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
  return (
    <Image
      src="/branding/apple-brand.svg"
      alt={`${os} icon`}
      width={20}
      height={20}
      className={className}
    />
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
            <a
              href={supportURL}
              {...(isSupportExternal
                ? { target: "_blank", rel: "noreferrer" }
                : undefined)}
            >
              Support
            </a>
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
                Run scheduled jobs on your own system with reliable timing, clear logs, retries, and easy cleanup.
              </p>

              <div className="hero-actions">
                <a className="btn btn-primary" href="#download">
                  Download App
                </a>
                <a
                  className="btn btn-subtle"
                  href="https://github.com/deep1283/cronye"
                  target="_blank"
                  rel="noreferrer"
                >
                  View Source
                </a>
                <a className="btn btn-secondary" href="#docs">
                  Quick Start
                </a>
              </div>

              <div className="cli-chip" aria-label="Install command">
                <span className="prompt">$</span>
                <code>cd daemon && go run ./cmd/daemon</code>
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.06}>
            <div className="hero-logo-only">
              <Image
                src="/branding/mascot.png"
                alt="Cronye mascot logo"
                width={420}
                height={420}
                className="hero-logo-image"
                priority
              />
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
                Install Cronye on your Apple Silicon Mac and start automating in minutes.
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
              After installing, launch Cronye from Applications and open the local dashboard.
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
            <p className="eyebrow">Getting started</p>
            <h2>How to start and use Cronye</h2>
            <p className="section-lead">
              Follow these simple steps to set up Cronye and run your first automation with confidence.
            </p>
          </FadeIn>

          <div className="docs-steps">
            {gettingStartedSteps.map((item, idx) => (
              <FadeIn key={item.title} delay={0.05 + idx * 0.03}>
                <article className="docs-step-card">
                  <span className="step-index">{idx + 1}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.24}>
            <div className="docs-links">
              <a className="btn btn-primary" href="#download">
                Download Cronye
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      <section id="pricing" className="section">
        <div className="container pricing-shell">
          <FadeIn>
              <p className="eyebrow">Open source</p>
              <h2>Free local automation for builders</h2>
          </FadeIn>

          <FadeIn delay={0.05}>
            <article className="price-card">
              <p className="price-amount">$0</p>
              <p className="price-sub">Open-source local cron product.</p>
              <ul>
                <li>Shell and HTTP jobs</li>
                <li>Retries with backoff and jitter</li>
                <li>Run history and output logs</li>
                <li>Retention and purge controls</li>
                <li>Apple Silicon Mac support</li>
              </ul>
              <p className="price-sub">Optional support keeps Cronye improving.</p>
              <a
                className="btn btn-primary"
                href="https://github.com/deep1283/cronye"
                target="_blank"
                rel="noreferrer"
              >
                Star on GitHub
              </a>
              <a
                className="btn btn-subtle"
                href={supportURL}
                {...(isSupportExternal
                  ? { target: "_blank", rel: "noreferrer" }
                  : undefined)}
              >
                Support Cronye ($9)
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
                <a href="https://github.com/deep1283/cronye" target="_blank" rel="noreferrer">GitHub</a>
              </nav>
            </div>

            <div className="footer-nav-group">
              <p className="footer-label">Company</p>
              <nav className="footer-links" aria-label="Footer company links">
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
