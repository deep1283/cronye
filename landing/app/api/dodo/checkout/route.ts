import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { saveIntent } from "@/lib/checkout-intents";
import { createCheckoutSession } from "@/lib/dodo-api";
import { verifyGoogleIDToken } from "@/lib/google-auth";
import { isValidEmail } from "@/lib/validation";

export const runtime = "nodejs";

type CheckoutRequest = {
  email?: string;
  name?: string;
  google_id_token?: string;
};

export async function POST(req: NextRequest) {
  let body: CheckoutRequest;
  try {
    body = (await req.json()) as CheckoutRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  const requestedEmail = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  const googleIDToken = (body.google_id_token ?? "").trim();

  let googleIdentity: Awaited<ReturnType<typeof verifyGoogleIDToken>> | null = null;
  if (googleIDToken) {
    try {
      googleIdentity = await verifyGoogleIDToken(googleIDToken);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "google_identity_verification_failed" },
        { status: 400 }
      );
    }
  }

  const email = googleIdentity?.email || requestedEmail;

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "valid_email_required" }, { status: 400 });
  }
  if (googleIdentity && requestedEmail && requestedEmail !== googleIdentity.email) {
    return NextResponse.json({ error: "google_email_mismatch" }, { status: 400 });
  }

  const productID = process.env.DODO_PRODUCT_ID;
  if (!productID) {
    return NextResponse.json({ error: "dodo_product_id_missing" }, { status: 500 });
  }

  const intentId = `intent_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const returnBase =
    process.env.DODO_RETURN_URL_BASE?.trim() || req.nextUrl.origin;
  const returnURL = `${returnBase}/checkout/success?intent=${intentId}`;

  try {
    const checkout = await createCheckoutSession({
      product_cart: [{ product_id: productID, quantity: 1 }],
      customer: { email, name },
      return_url: returnURL,
      metadata: {
        intent_id: intentId,
        source: "cronye_landing",
        ...(googleIdentity ? { google_sub: googleIdentity.sub } : {})
      }
    });

    const createdAt = new Date().toISOString();
    await saveIntent({
      id: intentId,
      email,
      googleEmail: googleIdentity?.email,
      googleSubject: googleIdentity?.sub,
      customerName: name || undefined,
      createdAt,
      updatedAt: createdAt,
      sessionId: checkout.session_id,
      checkoutURL: checkout.checkout_url,
      paymentStatus: "requires_payment_method",
      status: "created",
      paymentId: undefined
    });

    return NextResponse.json({
      intent_id: intentId,
      checkout_url: checkout.checkout_url
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "checkout_create_failed" },
      { status: 500 }
    );
  }
}
