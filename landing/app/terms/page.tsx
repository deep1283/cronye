export default function TermsPage() {
  return (
    <main className="checkout-shell">
      <section className="checkout-card policy-card">
        <p className="eyebrow">Terms of Service</p>
        <h1>Simple terms for a local-first product</h1>
        <p className="lead">
          Cronye runs completely on your own system. These terms cover purchase, license use, and
          support expectations.
        </p>

        <div className="policy-section">
          <h2>License access</h2>
          <p>
            A successful purchase provides a license key for using Cronye. You can recover your key
            later through the recovery flow.
          </p>
        </div>

        <div className="policy-section">
          <h2>Pricing</h2>
          <p>
            Pricing shown at checkout applies to your purchase. The current plan is a one-time
            payment for lifetime access to the local Cronye runtime.
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
            We provide help for checkout and license access. For help, support, or complaints,
            email <a href="mailto:deepmishra1283@gmail.com">deepmishra1283@gmail.com</a> or
            message{" "}
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
