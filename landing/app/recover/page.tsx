"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type RecoverResponse = {
  email: string;
  licenses: Array<{
    intent_id: string;
    license_key: string;
    license_signed: boolean;
    license_issued_at: string | null;
    purchased_at: string;
  }>;
};

type ErrorResponse = {
  error: string;
};

type GoogleIDCallbackResponse = {
  credential?: string;
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

export default function RecoverLicensePage() {
  const googleClientID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || "";
  const [googleScriptReady, setGoogleScriptReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RecoverResponse | null>(null);

  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleInitializedRef = useRef(false);

  useEffect(() => {
    if (!googleClientID || !googleScriptReady || !googleButtonRef.current) {
      return;
    }
    if (googleInitializedRef.current) return;
    if (!window.google?.accounts?.id) return;

    window.google.accounts.id.initialize({
      client_id: googleClientID,
      callback: async (response: GoogleIDCallbackResponse) => {
        const credential = response.credential?.trim();
        if (!credential) {
          setError("google_signin_failed");
          return;
        }

        setBusy(true);
        setError("");
        setResult(null);
        try {
          const recoverResp = await fetch("/api/license/recover", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ google_id_token: credential })
          });
          const payload = (await recoverResp.json()) as RecoverResponse | ErrorResponse;
          if (!recoverResp.ok) {
            throw new Error("error" in payload ? payload.error : "recover_license_failed");
          }
          if (!("licenses" in payload)) {
            throw new Error("recover_license_failed");
          }
          setResult(payload);
        } catch (err) {
          setError(err instanceof Error ? err.message : "recover_license_failed");
        } finally {
          setBusy(false);
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
  }, [googleClientID, googleScriptReady]);

  async function copyLicense(value: string) {
    await navigator.clipboard.writeText(value);
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
        <p className="eyebrow">Recover license</p>
        <h1>Get your key again</h1>
        <p className="lead">
          Sign in with the same Google account used during checkout. We will fetch your paid
          license key instantly.
        </p>

        <div className="checkout-identity">
          {googleClientID ? (
            <div ref={googleButtonRef} />
          ) : (
            <p className="error-line">Google sign-in is not configured.</p>
          )}
          {busy && <p className="small-note">Checking your paid licenses...</p>}
        </div>

        {error && <p className="error-line">Recover error: {error}</p>}

        {result && (
          <div className="status-stack">
            <p>
              Account: <strong>{result.email}</strong>
            </p>
            <p>
              Found <strong>{result.licenses.length}</strong> paid license
              {result.licenses.length > 1 ? "s" : ""}.
            </p>

            {result.licenses.map((item) => (
              <div key={item.intent_id} className="license-box">
                <p>
                  Purchase intent <code>{item.intent_id}</code>
                </p>
                <textarea readOnly value={item.license_key} />
                <div className="cta-row">
                  <button className="btn btn-primary" onClick={() => void copyLicense(item.license_key)}>
                    Copy License
                  </button>
                  <a className="btn btn-secondary" href="http://127.0.0.1:9480" target="_blank" rel="noreferrer">
                    Open Local App
                  </a>
                </div>
                <p className="small-note">
                  Purchased: {new Date(item.purchased_at).toLocaleString()}
                  {item.license_issued_at
                    ? ` • Issued: ${new Date(item.license_issued_at).toLocaleString()}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
