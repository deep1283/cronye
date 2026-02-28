"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";

type IntentStatus = {
  intent_id: string;
  status: "created" | "pending" | "succeeded" | "failed" | "cancelled";
  payment_status: string;
  license_key: string | null;
  license_signed: boolean;
  email: string;
  error?: string;
};

function CheckoutSuccessContent() {
  const searchParams = useSearchParams();
  const intentId = searchParams.get("intent") ?? "";
  const [state, setState] = useState<IntentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!intentId) return;
    try {
      const response = await fetch(`/api/dodo/checkout/intent/${intentId}`);
      const payload = (await response.json()) as IntentStatus;
      if (!response.ok) {
        throw new Error(payload.error ?? "intent_status_failed");
      }
      setState(payload);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "intent_status_failed");
    } finally {
      setLoading(false);
    }
  }, [intentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!state || state.status === "succeeded" || state.status === "failed") {
      return;
    }
    const interval = window.setInterval(() => {
      void load();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [load, state]);

  async function copyLicense() {
    if (!state?.license_key) return;
    await navigator.clipboard.writeText(state.license_key);
  }

  if (!intentId) {
    return (
      <main className="checkout-shell">
        <section className="checkout-card">
          <h1>Missing checkout intent</h1>
          <p>Return to the pricing page and start checkout again.</p>
          <a className="btn btn-primary" href="/#pricing">
            Back to pricing
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="checkout-shell">
      <section className="checkout-card">
        <p className="eyebrow">Checkout status</p>
        <h1>Purchase handoff</h1>
        {loading && <p className="lead">Checking payment status...</p>}
        {error && <p className="error-line">Status error: {error}</p>}

        {state && (
          <div className="status-stack">
            <p>
              Intent: <code>{state.intent_id}</code>
            </p>
            <p>
              Status: <strong>{state.status}</strong> ({state.payment_status})
            </p>
            <p>
              Email: <strong>{state.email}</strong>
            </p>

            {state.status === "succeeded" && state.license_key && (
              <div className="license-box">
                <p>
                  License generated ({state.license_signed ? "signed" : "dev unsigned"}).
                </p>
                <textarea readOnly value={state.license_key} />
                <div className="cta-row">
                  <button className="btn btn-primary" onClick={() => void copyLicense()}>
                    Copy License
                  </button>
                  <a
                    className="btn btn-secondary"
                    href="http://127.0.0.1:9480"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open Local App
                  </a>
                </div>
                <p className="small-note">
                  In Cronye local UI: Settings → License → paste and activate.
                </p>
              </div>
            )}

            {(state.status === "created" || state.status === "pending") && (
              <p className="lead">
                Payment is still processing. This page auto-refreshes every 3 seconds.
              </p>
            )}

            {state.status === "failed" && (
              <p className="error-line">
                Payment failed or was canceled. Please start checkout again.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="checkout-shell">
          <section className="checkout-card">
            <p className="lead">Loading checkout status...</p>
          </section>
        </main>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
