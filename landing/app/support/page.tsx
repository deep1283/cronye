"use client";

import { FormEvent, useState } from "react";

type SupportCheckoutResponse = {
  checkout_url: string;
};

type ErrorResponse = {
  error: string;
};

export default function SupportPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/support/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim() || undefined
        })
      });
      const payload = (await response.json()) as SupportCheckoutResponse | ErrorResponse;
      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "support_checkout_create_failed");
      }
      if (!("checkout_url" in payload) || !payload.checkout_url) {
        throw new Error("support_checkout_create_failed");
      }

      window.location.href = payload.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "support_checkout_create_failed");
      setBusy(false);
    }
  };

  return (
    <main className="checkout-shell">
      <section className="checkout-card">
        <a className="back-home" href="/" aria-label="Back to home page">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 5L8 12L15 19"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Home</span>
        </a>
        <p className="eyebrow">Optional support</p>
        <h1>Support Cronye with a one-time $9 coffee</h1>
        <p className="lead">
          Cronye stays free and open source. This support payment is optional and helps ongoing
          development.
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
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
            />
          </label>
          <button type="submit" disabled={busy}>
            {busy ? "Redirecting..." : "Continue to support checkout"}
          </button>
        </form>

        {error && <p className="error-note">{error}</p>}
      </section>
    </main>
  );
}
