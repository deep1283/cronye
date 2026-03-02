export default function TermsPage() {
  return (
    <main className="checkout-shell">
      <section className="checkout-card policy-card">
        <a className="back-home" href="/" aria-label="Back to home page">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Home</span>
        </a>
        <p className="eyebrow">Terms of Service</p>
        <h1>Simple terms for a local-first product</h1>
        <p className="lead">
          Cronye runs completely on your own system. These terms cover open-source usage and support
          expectations.
        </p>

        <div className="policy-section">
          <h2>Open-source use</h2>
          <p>
            Cronye is provided as open-source software for local use. You are responsible for how
            jobs are configured and executed on your machine.
          </p>
        </div>

        <div className="policy-section">
          <h2>How the product works</h2>
          <p>
            Cronye is local-first software. Job scheduling and execution operate on your own device
            and environment.
          </p>
        </div>

        <div className="policy-section">
          <h2>Support</h2>
          <p>
            For help, support, or complaints, email{" "}
            <a href="mailto:deepmishra1283@gmail.com">deepmishra1283@gmail.com</a> or message{" "}
            <a href="https://x.com/deepmishra1283" target="_blank" rel="noreferrer">
              @deepmishra1283 on X
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
