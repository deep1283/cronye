import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/dodo-api";

export const runtime = "nodejs";

type SupportCheckoutRequest = {
  email?: string;
  name?: string;
};

function isValidEmail(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export async function POST(req: NextRequest) {
  let body: SupportCheckoutRequest;
  try {
    body = (await req.json()) as SupportCheckoutRequest;
  } catch {
    return NextResponse.json({ error: "invalid_json_body" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "valid_email_required" }, { status: 400 });
  }

  const productID = process.env.DODO_PRODUCT_ID?.trim();
  if (!productID) {
    return NextResponse.json({ error: "dodo_product_id_missing" }, { status: 500 });
  }

  const returnBase = process.env.DODO_RETURN_URL_BASE?.trim() || req.nextUrl.origin;
  const returnURL = `${returnBase}/support?status=success`;

  try {
    const checkout = await createCheckoutSession({
      product_cart: [{ product_id: productID, quantity: 1 }],
      customer: { email, name: name || undefined },
      return_url: returnURL,
      metadata: {
        source: "cronye_optional_support"
      }
    });

    return NextResponse.json({
      checkout_url: checkout.checkout_url
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "support_checkout_create_failed" },
      { status: 500 }
    );
  }
}
