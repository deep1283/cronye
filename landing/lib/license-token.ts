import { createPrivateKey, randomUUID, sign } from "node:crypto";

type Claims = {
  license_id: string;
  email: string;
  plan: string;
  issued_at: string;
  device_limit: number;
  expires_at?: string;
};

function toBase64URL(input: Buffer | string): string {
  const raw = typeof input === "string" ? Buffer.from(input) : input;
  return raw
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function issueLicenseKey(email: string): {
  key: string;
  signed: boolean;
} {
  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date().toISOString();
  const claims: Claims = {
    license_id: `lic_${randomUUID().replace(/-/g, "").slice(0, 16)}`,
    email: normalizedEmail,
    plan: "lifetime",
    issued_at: now,
    device_limit: 1
  };

  const privateKeyPEM = process.env.CRONYE_LICENSE_PRIVATE_KEY_PEM?.replace(
    /\\n/g,
    "\n"
  );

  if (!privateKeyPEM) {
    const payload = toBase64URL(JSON.stringify(claims));
    return { key: `plain:${payload}`, signed: false };
  }

  const payloadBuffer = Buffer.from(JSON.stringify(claims));
  const keyObject = createPrivateKey(privateKeyPEM);
  const signature = sign(null, payloadBuffer, keyObject);

  const token = `cronye1.${toBase64URL(payloadBuffer)}.${toBase64URL(signature)}`;
  return { key: token, signed: true };
}
