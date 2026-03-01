export default function PrivacyPage() {
  return (
    <main className="checkout-shell">
      <section className="checkout-card policy-card">
        <p className="eyebrow">Privacy Policy</p>
        <h1>Your automation runs on your own system</h1>
        <p className="lead">
          Cronye runs completely on your own machine. Your jobs, schedules, and run logs stay on
          your local system.
        </p>

        <div className="policy-section">
          <h2>What we use for account recovery</h2>
          <p>
            If you choose Google sign-in for license recovery, we store your Google account ID and
            email together with your paid license record so you can get your key again after
            reinstalling.
          </p>
        </div>

        <div className="policy-section">
          <h2>Payments</h2>
          <p>
            Checkout is handled by Dodo Payments. We store purchase intent details needed to issue
            and recover your license key.
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
            For support with license recovery or account updates, contact the support channel listed
            on the Cronye website.
          </p>
        </div>
      </section>
    </main>
  );
}
