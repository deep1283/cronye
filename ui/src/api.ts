import type {
  CancelRunningResult,
  HealthResponse,
  Job,
  JobUpsertPayload,
  LicenseStatus,
  PurgePayload,
  PurgeResult,
  RetentionPayload,
  RetentionUpdateResult,
  Run,
  RunNowResult,
  Settings,
  StorageUsage
} from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "/api";

class APIError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? ((await response.json()) as Record<string, unknown>)
    : {};

  if (!response.ok) {
    const errorText =
      typeof body.error === "string" ? body.error : `request_failed_${response.status}`;
    throw new APIError(response.status, errorText);
  }

  return body as T;
}

async function requestText(path: string): Promise<string> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new APIError(response.status, `request_failed_${response.status}`);
  }
  return response.text();
}

export const api = {
  getHealth: () => request<HealthResponse>("/health"),
  listJobs: () => request<{ jobs: Job[] }>("/jobs"),
  getJob: (id: string) => request<Job>(`/jobs/${id}`),
  createJob: (payload: JobUpsertPayload) =>
    request<Job>("/jobs", { method: "POST", body: JSON.stringify(payload) }),
  updateJob: (id: string, payload: JobUpsertPayload) =>
    request<Job>(`/jobs/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  pauseJob: (id: string) => request<Job>(`/jobs/${id}/pause`, { method: "POST" }),
  resumeJob: (id: string) => request<Job>(`/jobs/${id}/resume`, { method: "POST" }),
  deleteJob: async (id: string) => {
    await request<Record<string, never>>(`/jobs/${id}`, { method: "DELETE" });
  },
  runJobNow: (id: string) =>
    request<RunNowResult>(`/jobs/${id}/run`, { method: "POST" }),
  cancelRunningByJob: (id: string) =>
    request<CancelRunningResult>(`/jobs/${id}/cancel-running`, { method: "POST" }),
  listRunsByJob: (id: string) => request<{ runs: Run[] }>(`/jobs/${id}/runs`),
  getRun: (id: string) => request<Run>(`/runs/${id}`),
  getRunOutput: (id: string) => requestText(`/runs/${id}/output`),
  getStorageUsage: () => request<StorageUsage>("/storage/usage"),
  purge: (payload: PurgePayload) =>
    request<PurgeResult>("/maintenance/purge", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getSettings: () => request<Settings>("/settings"),
  updateRetentionSettings: (payload: RetentionPayload) =>
    request<RetentionUpdateResult>("/settings/retention", {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  updateAlertsSettings: (alertWebhookURL: string) =>
    request<{ alert_webhook_url: string }>("/settings/alerts", {
      method: "PUT",
      body: JSON.stringify({ alert_webhook_url: alertWebhookURL })
    }),
  getLicense: () => request<LicenseStatus>("/license"),
  activateLicense: (licenseKey: string) =>
    request<LicenseStatus>("/license/activate", {
      method: "POST",
      body: JSON.stringify({ license_key: licenseKey })
    }),
  deactivateLicense: () =>
    request<{ status: string }>("/license/deactivate", {
      method: "POST"
    })
};

export { APIError };
