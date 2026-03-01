type TokenInfoResponse = {
  aud?: string;
  azp?: string;
  sub?: string;
  email?: string;
  email_verified?: string | boolean;
  name?: string;
  picture?: string;
  exp?: string;
};

export type GoogleIdentity = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
  audience: string;
  expiresAtUnix: number;
};

function asBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

export async function verifyGoogleIDToken(idTokenRaw: string): Promise<GoogleIdentity> {
  const idToken = idTokenRaw.trim();
  if (!idToken) {
    throw new Error("google_id_token_required");
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    { cache: "no-store" }
  );
  if (!response.ok) {
    throw new Error(`google_tokeninfo_failed_${response.status}`);
  }

  const payload = (await response.json()) as TokenInfoResponse;
  const sub = payload.sub?.trim() ?? "";
  const email = payload.email?.trim().toLowerCase() ?? "";
  const aud = payload.aud?.trim() ?? "";
  const exp = Number(payload.exp ?? "0");
  const emailVerified = asBool(payload.email_verified);

  if (!sub || !email || !aud || Number.isNaN(exp) || exp <= 0) {
    throw new Error("google_identity_incomplete");
  }
  if (!emailVerified) {
    throw new Error("google_email_not_verified");
  }
  if (exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("google_id_token_expired");
  }

  const expectedAudience =
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    "";

  if (expectedAudience && aud !== expectedAudience) {
    throw new Error("google_audience_mismatch");
  }

  return {
    sub,
    email,
    emailVerified,
    name: payload.name?.trim() || undefined,
    picture: payload.picture?.trim() || undefined,
    audience: aud,
    expiresAtUnix: exp
  };
}
