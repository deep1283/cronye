import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/lib/dodo-api";

export const runtime = "nodejs";

function supportCheckoutEmail() {
  const domain = process.env.SUPPORT_CHECKOUT_EMAIL_DOMAIN?.trim() || "cronye.app";
  const token = randomUUID().replace(/-/g, "").slice(0, 12);
  return `supporter+${token}@${domain}`;
}

export async function GET(req: NextRequest) {
  const email = supportCheckoutEmail();
  const name = "Cronye Supporter";

  const productID = process.env.DODO_PRODUCT_ID?.trim();
  if (!productID) {
    return NextResponse.json({ error: "dodo_product_id_missing" }, { status: 500 });
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "support_checkout_create_failed" },
      { status: 500 }
    );
  }
}
