import { NextRequest, NextResponse } from "next/server";
import {
  findIntentByPaymentId,
  findIntentBySessionId,
  getIntent,
  updateIntent
} from "@/lib/checkout-intents";
import { retrieveCheckoutSession } from "@/lib/dodo-api";
import { issueLicenseKey } from "@/lib/license-token";
import {
  isReasonableTimestamp,
  verifyDodoWebhookSignature
} from "@/lib/dodo-webhook";

export const runtime = "nodejs";

type AnyJSON = Record<string, unknown>;

function asObject(value: unknown): AnyJSON {
  if (!value || typeof value !== "object") return {};
  return value as AnyJSON;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function extractIntentID(payload: AnyJSON): string {
  const data = asObject(payload.data);
  const metadata = asObject(data.metadata);
  const rootMetadata = asObject(payload.metadata);
  return (
    asString(metadata.intent_id) ||
    asString(data.intent_id) ||
    asString(rootMetadata.intent_id)
  );
}

function extractSessionID(payload: AnyJSON): string {
  const data = asObject(payload.data);
  return (
    asString(data.checkout_session_id) ||
    asString(data.session_id) ||
    asString(data.id)
  );
}

function extractPaymentID(payload: AnyJSON): string {
  const data = asObject(payload.data);
  return asString(data.payment_id) || asString(payload.payment_id);
}

function normalizeStatus(payload: AnyJSON): "succeeded" | "failed" | "cancelled" | "pending" {
  const eventType = asString(payload.type).toLowerCase();
  const data = asObject(payload.data);
  const paymentStatus = asString(data.payment_status).toLowerCase();
  const status = asString(data.status).toLowerCase();

  if (
    eventType.includes("succeeded") ||
    paymentStatus === "succeeded" ||
    status === "succeeded"
  ) {
    return "succeeded";
  }
  if (
    eventType.includes("failed") ||
    paymentStatus === "failed" ||
    status === "failed"
  ) {
    return "failed";
  }
  if (
    eventType.includes("cancel") ||
    paymentStatus === "cancelled" ||
    status === "cancelled"
  ) {
    return "cancelled";
  }
  return "pending";
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.DODO_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json({ error: "dodo_webhook_secret_missing" }, { status: 500 });
  }

  const payloadRaw = await req.text();
  const webhookID = req.headers.get("webhook-id") || "";
  const webhookTimestamp = req.headers.get("webhook-timestamp") || "";
  const webhookSignature = req.headers.get("webhook-signature") || "";

  if (!webhookID || !webhookTimestamp || !webhookSignature) {
    return NextResponse.json({ error: "missing_webhook_headers" }, { status: 400 });
  }
  if (!isReasonableTimestamp(webhookTimestamp)) {
    return NextResponse.json({ error: "stale_or_invalid_webhook_timestamp" }, { status: 400 });
  }
  if (
    !verifyDodoWebhookSignature({
      payload: payloadRaw,
      webhookID,
      webhookTimestamp,
      webhookSignature,
      secret: webhookSecret
    })
  ) {
    return NextResponse.json({ error: "invalid_webhook_signature" }, { status: 401 });
  }

  let payload: AnyJSON;
  try {
    payload = JSON.parse(payloadRaw) as AnyJSON;
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  const normalized = normalizeStatus(payload);
  const intentId = extractIntentID(payload);
  const sessionId = extractSessionID(payload);
  const paymentId = extractPaymentID(payload);

  let intent =
    (intentId ? await getIntent(intentId) : null) ||
    (sessionId ? await findIntentBySessionId(sessionId) : null) ||
    (paymentId ? await findIntentByPaymentId(paymentId) : null);

  if (!intent) {
    return NextResponse.json({ status: "ignored", reason: "intent_not_found" });
  }

  const patch: Parameters<typeof updateIntent>[1] = {
    status: normalized,
    paymentStatus: normalized,
    paymentId: paymentId || intent.paymentId
  };

  if (normalized === "succeeded" && !intent.licenseKey) {
    const checkout = await retrieveCheckoutSession(intent.sessionId);
    const checkoutStatus = asString(checkout.payment_status).toLowerCase();
    if (checkoutStatus !== "succeeded") {
      return NextResponse.json(
        { status: "ignored", reason: "checkout_not_paid" },
        { status: 409 }
      );
    }

    const issued = issueLicenseKey(intent.email);
    patch.licenseKey = issued.key;
    patch.licenseSigned = issued.signed;
    patch.licenseIssuedAt = new Date().toISOString();
  } else if (normalized !== "succeeded") {
    patch.licenseKey = undefined;
    patch.licenseSigned = undefined;
    patch.licenseIssuedAt = undefined;
  }

  intent = await updateIntent(intent.id, patch);
  if (!intent) {
    return NextResponse.json({ error: "intent_update_failed" }, { status: 500 });
  }

  return NextResponse.json({
    status: "ok",
    intent_id: intent.id,
    payment_status: intent.paymentStatus,
    checkout_status: intent.status,
    license_issued: Boolean(intent.licenseKey)
  });
}
