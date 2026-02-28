"use client";

import { FormEvent, useState } from "react";

type CheckoutResponse = {
  intent_id: string;
  checkout_url: string;
};
type ErrorResponse = { error: string };

export default function CheckoutPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/dodo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name })
      });
      const payload = (await response.json()) as
        | CheckoutResponse
        | ErrorResponse;
      if (!response.ok) {
        throw new Error(
          "error" in payload ? payload.error : "checkout_create_failed"
        );
      }
      if (!("checkout_url" in payload)) {
        throw new Error("checkout_create_failed");
      }
      window.location.href = payload.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "checkout_create_failed");
      setBusy(false);
    }
  }

  return (
    <main className="checkout-shell">
      <section className="checkout-card">
        <p className="eyebrow">Cronye checkout</p>
        <h1>Start test purchase</h1>
        <p className="lead">
          You will be redirected to Dodo test checkout for the $39 lifetime plan.
        </p>

        <form onSubmit={onSubmit} className="checkout-form">
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            <span>Name (optional)</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
            />
          </label>

          <button type="submit" disabled={busy}>
            {busy ? "Redirecting..." : "Continue to Dodo Checkout"}
          </button>
        </form>

        {error && <p className="error-line">Checkout error: {error}</p>}
      </section>
    </main>
  );
}
