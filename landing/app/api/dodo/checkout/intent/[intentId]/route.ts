import { NextRequest, NextResponse } from "next/server";
import { getIntent, updateIntent } from "@/lib/checkout-intents";
import { retrieveCheckoutSession } from "@/lib/dodo-api";
import { issueLicenseKey } from "@/lib/license-token";

export const runtime = "nodejs";

function mapStatus(paymentStatus: string): "pending" | "succeeded" | "failed" | "cancelled" {
  switch (paymentStatus) {
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ intentId: string }> }
) {
  const { intentId } = await context.params;
  const intent = await getIntent(intentId);
  if (!intent) {
    return NextResponse.json({ error: "intent_not_found" }, { status: 404 });
  }

  if (intent.licenseKey) {
    return NextResponse.json({
      intent_id: intent.id,
      status: intent.status,
      payment_status: intent.paymentStatus,
      license_key: intent.licenseKey,
      license_signed: Boolean(intent.licenseSigned),
      email: intent.email
    });
  }

  try {
    const checkout = await retrieveCheckoutSession(intent.sessionId);
    const paymentStatus = checkout.payment_status || "requires_payment_method";
    const normalizedStatus = mapStatus(paymentStatus);

    const patch: Parameters<typeof updateIntent>[1] = {
      paymentStatus,
      status: normalizedStatus,
      paymentId: checkout.payment_id || intent.paymentId
    };

    if (normalizedStatus === "succeeded") {
      const license = issueLicenseKey(intent.email);
      patch.licenseKey = license.key;
      patch.licenseSigned = license.signed;
      patch.licenseIssuedAt = new Date().toISOString();
    }

    const updated = await updateIntent(intent.id, patch);
    if (!updated) {
      return NextResponse.json({ error: "intent_update_failed" }, { status: 500 });
    }

    return NextResponse.json({
      intent_id: updated.id,
      status: updated.status,
      payment_status: updated.paymentStatus,
      license_key: updated.licenseKey ?? null,
      license_signed: Boolean(updated.licenseSigned),
      email: updated.email
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "intent_status_failed",
        status: intent.status,
        payment_status: intent.paymentStatus
      },
      { status: 500 }
    );
  }
}
