type DodoCheckoutSessionCreateRequest = {
  product_cart: Array<{ product_id: string; quantity: number }>;
  customer: { email: string; name?: string };
  return_url: string;
  metadata?: Record<string, string>;
};

export type DodoCheckoutSession = {
  checkout_url: string;
  session_id: string;
  payment_status: string;
  payment_id?: string;
  customer_email?: string;
};

function dodoBaseURL() {
  const environment = process.env.DODO_PAYMENTS_ENVIRONMENT?.trim();
  return environment === "live_mode"
    ? "https://live.dodopayments.com"
    : "https://test.dodopayments.com";
}

function dodoAPIKey() {
  const key = process.env.DODO_PAYMENTS_API_KEY?.trim();
  if (!key) {
    throw new Error("dodo_api_key_missing");
  }
  return key;
}

async function dodoRequest<T>(
  path: string,
  init?: RequestInit & { bodyJSON?: unknown }
): Promise<T> {
  const response = await fetch(`${dodoBaseURL()}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${dodoAPIKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    body: init?.bodyJSON ? JSON.stringify(init.bodyJSON) : init?.body
  });

  const rawText = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
  } catch {
    payload = { error: rawText };
  }
  if (!response.ok) {
    const message =
      (typeof payload.detail === "string" && payload.detail) ||
      (typeof payload.error === "string" && payload.error) ||
      `dodo_request_failed_${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export async function createCheckoutSession(
  input: DodoCheckoutSessionCreateRequest
): Promise<DodoCheckoutSession> {
  return dodoRequest<DodoCheckoutSession>("/checkouts", {
    method: "POST",
    bodyJSON: input
  });
}
