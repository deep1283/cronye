"use client";

import Script from "next/script";
import { FormEvent, useEffect, useRef, useState } from "react";

type CheckoutResponse = {
  intent_id: string;
  checkout_url: string;
};
type ErrorResponse = { error: string };

type GoogleIDCallbackResponse = {
  credential?: string;
};

type GooglePayloadHint = {
  email?: string;
  name?: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (input: {
            client_id: string;
            callback: (response: GoogleIDCallbackResponse) => void;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: Record<string, string | number | boolean>
          ) => void;
        };
      };
    };
  }
}

function decodeGooglePayloadHint(token: string): GooglePayloadHint {
  try {
    const payloadPart = token.split(".")[1] ?? "";
    if (!payloadPart) return {};
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    const payload = JSON.parse(json) as Record<string, unknown>;
    return {
      email: typeof payload.email === "string" ? payload.email : undefined,
      name: typeof payload.name === "string" ? payload.name : undefined
    };
  } catch {
    return {};
  }
}

export default function CheckoutPage() {
  const googleClientID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || "";
  const [googleScriptReady, setGoogleScriptReady] = useState(false);
  const [googleIDToken, setGoogleIDToken] = useState("");
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleName, setGoogleName] = useState("");
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleInitializedRef = useRef(false);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!googleClientID || !googleScriptReady || !googleButtonRef.current) {
      return;
    }
    if (googleInitializedRef.current) return;
    if (!window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: googleClientID,
      callback: (response: GoogleIDCallbackResponse) => {
        const credential = response.credential?.trim();
        if (!credential) {
          setError("google_signin_failed");
          return;
        }
        const hint = decodeGooglePayloadHint(credential);
        const hintedEmail = hint.email?.trim().toLowerCase() ?? "";
        const hintedName = hint.name?.trim() ?? "";

        setGoogleIDToken(credential);
        setGoogleEmail(hintedEmail);
        setGoogleName(hintedName);
        if (!email && hintedEmail) {
          setEmail(hintedEmail);
        }
        if (!name && hintedName) {
          setName(hintedName);
        }
      }
    });

    window.google.accounts.id.renderButton(googleButtonRef.current, {
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "pill",
      width: 320
    });
    googleInitializedRef.current = true;
  }, [email, googleClientID, googleScriptReady, name]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/dodo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name,
          google_id_token: googleIDToken || undefined
        })
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
      {googleClientID && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={() => setGoogleScriptReady(true)}
        />
      )}
      <section className="checkout-card">
        <p className="eyebrow">Cronye checkout</p>
        <h1>Start test purchase</h1>
        <p className="lead">
          You will be redirected to Dodo test checkout for the $9 lifetime plan.
        </p>

        <div className="checkout-identity">
          <p className="small-note">
            Recommended: sign in with Google so you can recover your license key later.
          </p>
          {googleClientID ? (
            <>
              <div ref={googleButtonRef} />
              {googleEmail && (
                <p className="small-note">
                  Signed in as <strong>{googleName ? `${googleName} (${googleEmail})` : googleEmail}</strong>
                </p>
              )}
            </>
          ) : (
            <p className="small-note">Google sign-in is not configured yet.</p>
          )}
        </div>

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
