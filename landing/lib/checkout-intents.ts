import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type IntentStatus = "created" | "pending" | "succeeded" | "failed" | "cancelled";

export type CheckoutIntent = {
  id: string;
  email: string;
  customerName?: string;
  createdAt: string;
  updatedAt: string;
  sessionId: string;
  checkoutURL: string;
  paymentStatus: string;
  status: IntentStatus;
  licenseKey?: string;
  licenseSigned?: boolean;
  licenseIssuedAt?: string;
  paymentId?: string;
};

const dataDir = path.join(process.cwd(), ".data");
const dataFile = path.join(dataDir, "checkout-intents.json");

type IntentStore = {
  intents: Record<string, CheckoutIntent>;
};

async function ensureStore(): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    const initial: IntentStore = { intents: {} };
    await writeFile(dataFile, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<IntentStore> {
  await ensureStore();
  const raw = await readFile(dataFile, "utf8");
  return JSON.parse(raw) as IntentStore;
}

async function writeStore(store: IntentStore): Promise<void> {
  await ensureStore();
  await writeFile(dataFile, JSON.stringify(store, null, 2), "utf8");
}

export async function saveIntent(intent: CheckoutIntent): Promise<void> {
  const store = await readStore();
  store.intents[intent.id] = intent;
  await writeStore(store);
}

export async function getIntent(intentId: string): Promise<CheckoutIntent | null> {
  const store = await readStore();
  return store.intents[intentId] ?? null;
}

export async function updateIntent(
  intentId: string,
  patch: Partial<CheckoutIntent>
): Promise<CheckoutIntent | null> {
  const store = await readStore();
  const existing = store.intents[intentId];
  if (!existing) return null;

  const updated: CheckoutIntent = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  store.intents[intentId] = updated;
  await writeStore(store);
  return updated;
}
