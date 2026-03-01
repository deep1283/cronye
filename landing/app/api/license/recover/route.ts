import { NextRequest, NextResponse } from "next/server";
import {
  listIntents,
  type CheckoutIntent,
  updateIntent
} from "@/lib/checkout-intents";
import { verifyGoogleIDToken } from "@/lib/google-auth";

export const runtime = "nodejs";

type RecoverRequest = {
  google_id_token?: string;
};

function isPaidIntent(intent: CheckoutIntent): boolean {
  return (
    intent.status === "succeeded" &&
    intent.paymentStatus === "succeeded" &&
    Boolean(intent.licenseKey)
  );
}

export async function POST(req: NextRequest) {
  let body: RecoverRequest;
  try {
    body = (await req.json()) as RecoverRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  const googleIDToken = (body.google_id_token ?? "").trim();
  if (!googleIDToken) {
    return NextResponse.json({ error: "google_id_token_required" }, { status: 400 });
  }

  let identity: Awaited<ReturnType<typeof verifyGoogleIDToken>>;
  try {
    identity = await verifyGoogleIDToken(googleIDToken);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "google_identity_verification_failed" },
      { status: 400 }
    );
  }

  const intents = await listIntents();
  const paid = intents.filter(isPaidIntent);

  let owned = paid.filter((intent) => intent.googleSubject === identity.sub);

  // Backfill ownership for old purchases that only had email linkage.
  if (owned.length === 0) {
    const byEmail = paid.filter((intent) => intent.email === identity.email);
    if (byEmail.length > 0) {
      await Promise.all(
        byEmail.map((intent) =>
          updateIntent(intent.id, {
            googleSubject: identity.sub,
            googleEmail: identity.email
          })
        )
      );
      owned = byEmail;
    }
  }

  if (owned.length === 0) {
    return NextResponse.json({ error: "no_paid_license_for_google_account" }, { status: 404 });
  }

  owned.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  return NextResponse.json({
    email: identity.email,
    licenses: owned.map((intent) => ({
      intent_id: intent.id,
      license_key: intent.licenseKey,
      license_signed: Boolean(intent.licenseSigned),
      license_issued_at: intent.licenseIssuedAt ?? null,
      purchased_at: intent.createdAt
    }))
  });
}
