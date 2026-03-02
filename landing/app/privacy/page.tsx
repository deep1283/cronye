export default function PrivacyPage() {
  return (
    <main className="checkout-shell">
      <section className="checkout-card policy-card">
        <a className="back-home" href="/" aria-label="Back to home page">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 5L8 12L15 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Home</span>
        </a>
        <p className="eyebrow">Privacy Policy</p>
        <h1>Your automation runs on your own system</h1>
        <p className="lead">
          Cronye runs completely on your own machine. Your jobs, schedules, and run logs stay on
          your local system.
        </p>

        <div className="policy-section">
          <h2>No account required</h2>
          <p>
            Cronye does not require sign-in to run locally. We do not require Google login or
            payment account linking for product access.
          </p>
        </div>

        <div className="policy-section">
          <h2>Product data location</h2>
          <p>
            Cronye job execution data is local-first. It is created and used on your device for the
            local scheduler and dashboard experience.
          </p>
        </div>

        <div className="policy-section">
          <h2>Contact</h2>
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
