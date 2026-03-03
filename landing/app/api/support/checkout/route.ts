import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/dodo-api";

export const runtime = "nodejs";

function supportCheckoutEmail() {
  const domain = process.env.SUPPORT_CHECKOUT_EMAIL_DOMAIN?.trim() || "cronye.app";
  const token = randomUUID().replace(/-/g, "").slice(0, 12);
  return `supporter+${token}@${domain}`;
}

function supportFallbackURL(req: NextRequest) {
  return (
    process.env.SUPPORT_FALLBACK_URL?.trim() ||
    process.env.NEXT_PUBLIC_REPO_URL?.trim() ||
    "https://github.com/deep1283/cronye"
  );
}

function fallback(req: NextRequest, reason: string) {
  const response = NextResponse.redirect(supportFallbackURL(req));
  response.headers.set("x-support-fallback-reason", reason);
  return response;
}

export async function GET(req: NextRequest) {
  const email = supportCheckoutEmail();
  const name = "Cronye Supporter";

  const productID = process.env.DODO_PRODUCT_ID?.trim();
  if (!productID) {
    return fallback(req, "dodo_product_id_missing");
  }

  const returnBase = process.env.DODO_RETURN_URL_BASE?.trim() || req.nextUrl.origin;
  const returnURL = `${returnBase}/#pricing`;

  try {
    const checkout = await createCheckoutSession({
      product_cart: [{ product_id: productID, quantity: 1 }],
      customer: { email, name },
      return_url: returnURL,
      metadata: {
        source: "cronye_optional_support"
      }
    });

    return NextResponse.redirect(checkout.checkout_url);
  } catch (error) {
    const reason =
      error instanceof Error && error.message ? error.message : "support_checkout_create_failed";
    console.error("[support-checkout] fallback", {
      reason,
      hasProductID: Boolean(productID),
      environment: process.env.DODO_PAYMENTS_ENVIRONMENT ?? "unset"
    });
    return fallback(req, reason);
  }
}
