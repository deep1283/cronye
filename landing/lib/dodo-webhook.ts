import { createHmac, timingSafeEqual } from "node:crypto";

function toBase64URL(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizeSignatureCandidates(header: string): string[] {
  return header
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.replace(/^v\d+=/i, ""))
    .map((item) => item.replace(/^v\d+,/i, ""));
}

function safeEquals(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function verifyDodoWebhookSignature(input: {
  payload: string;
  webhookID: string;
  webhookTimestamp: string;
  webhookSignature: string;
  secret: string;
}): boolean {
  const signedMessage = `${input.webhookID}.${input.webhookTimestamp}.${input.payload}`;
  const digest = createHmac("sha256", input.secret).update(signedMessage).digest();

  const candidates = normalizeSignatureCandidates(input.webhookSignature);
  if (candidates.length === 0) return false;

  const knownFormats = [digest.toString("hex"), digest.toString("base64"), toBase64URL(digest)];

  for (const candidate of candidates) {
    for (const known of knownFormats) {
      if (safeEquals(candidate, known)) return true;
    }
  }

  return false;
}

export function isReasonableTimestamp(webhookTimestamp: string): boolean {
  const nowSec = Math.floor(Date.now() / 1000);
  const parsed = Number(webhookTimestamp);
  if (!Number.isFinite(parsed)) return false;
  const diff = Math.abs(nowSec - parsed);
  return diff <= 60 * 15;
}
