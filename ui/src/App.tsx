import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { APIError, api } from "./api";
import type {
  Job,
  JobType,
  JobUpsertPayload,
  OverlapPolicy,
  Run,
  Settings,
  StorageUsage
} from "./types";

type Panel = "runs" | "storage" | "settings";
type Notice = { type: "info" | "error"; text: string } | null;
type RunFilter = "all" | "queued" | "running" | "success" | "failed" | "cancelled";

type JobFormState = {
  name: string;
  type: JobType;
  schedule: string;
  timezone: string;
  enabled: boolean;
  timeoutSec: number;
  retryMax: number;
  retryBackoffSec: number;
  overlapPolicy: OverlapPolicy;
  shellCommand: string;
  httpMethod: string;
  httpURL: string;
  httpHeaders: string;
  httpBody: string;
};

const FALLBACK_TIMEZONES = ["UTC", "Asia/Kolkata", "America/New_York"];

const timezoneOptions = (() => {
  const intlObject = Intl as unknown as {
    supportedValuesOf?: (key: string) => string[];
  };
  if (typeof intlObject.supportedValuesOf === "function") {
    return intlObject.supportedValuesOf("timeZone");
  }
  return FALLBACK_TIMEZONES;
})();

function buildDefaultForm(): JobFormState {
  return {
    name: "",
    type: "shell",
    schedule: "*/5 * * * *",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    enabled: true,
    timeoutSec: 300,
    retryMax: 0,
    retryBackoffSec: 10,
    overlapPolicy: "skip",
    shellCommand: "",
    httpMethod: "GET",
    httpURL: "",
    httpHeaders: "{}",
    httpBody: ""
  };
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatBytes(value?: number) {
  if (value === undefined) return "-";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function parseAPIError(error: unknown) {
  if (error instanceof APIError) return error.message;
  if (error instanceof Error) return error.message;
  return "unknown_error";
}

function statusTone(status: string) {
  if (status === "success") return "bg-emerald-100 text-emerald-800";
  if (status === "running") return "bg-sky-100 text-sky-800";
  if (status === "queued") return "bg-amber-100 text-amber-800";
  if (status === "cancelled" || status === "skipped_overlap") return "bg-slate-200 text-slate-800";
  return "bg-red-100 text-red-800";
}

function jobToForm(job: Job): JobFormState {
  const base = buildDefaultForm();
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(job.payload_json) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  const httpHeaders =
    payload.headers && typeof payload.headers === "object"
      ? JSON.stringify(payload.headers, null, 2)
      : "{}";

  return {
    ...base,
    name: job.name,
    type: job.type,
    schedule: job.schedule,
    timezone: job.timezone,
    enabled: job.enabled,
    timeoutSec: job.timeout_sec,
    retryMax: job.retry_max,
    retryBackoffSec: job.retry_backoff_sec,
    overlapPolicy: job.overlap_policy,
    shellCommand: typeof payload.command === "string" ? payload.command : "",
    httpMethod: typeof payload.method === "string" ? payload.method : "GET",
    httpURL: typeof payload.url === "string" ? payload.url : "",
    httpHeaders,
    httpBody: typeof payload.body === "string" ? payload.body : ""
  };
}

function App() {
  const [healthStatus, setHealthStatus] = useState<string>("loading");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [storage, setStorage] = useState<StorageUsage | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runOutput, setRunOutput] = useState<string>("");
  const [panel, setPanel] = useState<Panel>("runs");
  const [runFilter, setRunFilter] = useState<RunFilter>("all");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [jobForm, setJobForm] = useState<JobFormState>(buildDefaultForm());
  const [purgeDays, setPurgeDays] = useState<number>(30);
  const [purgeSuccessOnly, setPurgeSuccessOnly] = useState<boolean>(false);
  const [settingsDraft, setSettingsDraft] = useState({
    retention_days: 30,
    max_log_bytes: 1_073_741_824,
    global_concurrency: 1 as 1 | 2
  });
  const [alertWebhookDraft, setAlertWebhookDraft] = useState<string>("");

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );

  const filteredRuns = useMemo(() => {
    if (runFilter === "all") return runs;
    return runs.filter((run) => run.status === runFilter);
  }, [runs, runFilter]);

  const loadHealth = useCallback(async () => {
    try {
      const health = await api.getHealth();
      setHealthStatus(health.status);
    } catch {
      setHealthStatus("down");
    }
  }, []);

  const loadJobs = useCallback(async () => {
    const response = await api.listJobs();
    setJobs(response.jobs);
    if (selectedJobId && !response.jobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(null);
      setJobForm(buildDefaultForm());
      setRuns([]);
    }
  }, [selectedJobId]);

  const loadRuns = useCallback(async (jobID: string) => {
    const response = await api.listRunsByJob(jobID);
    setRuns(response.runs);
  }, []);

  const loadStorage = useCallback(async () => {
    const usage = await api.getStorageUsage();
    setStorage(usage);
  }, []);

  const loadSettings = useCallback(async () => {
    const currentSettings = await api.getSettings();
    setSettings(currentSettings);
    setSettingsDraft({
      retention_days: currentSettings.retention_days,
      max_log_bytes: currentSettings.max_log_bytes,
      global_concurrency: currentSettings.global_concurrency
    });
    setAlertWebhookDraft(currentSettings.alert_webhook_url ?? "");
  }, []);

  const loadAll = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      await Promise.all([loadHealth(), loadJobs(), loadStorage(), loadSettings()]);
      if (selectedJobId) {
        await loadRuns(selectedJobId);
      }
    } catch (error) {
      setNotice({ type: "error", text: parseAPIError(error) });
    } finally {
      setBusy(false);
    }
  }, [loadHealth, loadJobs, loadRuns, loadSettings, loadStorage, selectedJobId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadHealth();
      void loadJobs();
      if (selectedJobId) void loadRuns(selectedJobId);
    }, 8000);
    return () => window.clearInterval(interval);
  }, [loadHealth, loadJobs, loadRuns, selectedJobId]);

  const selectJob = useCallback(
    async (job: Job) => {
      setSelectedJobId(job.id);
      setJobForm(jobToForm(job));
      setPanel("runs");
      setSelectedRunId(null);
      setRunOutput("");
      try {
        await loadRuns(job.id);
      } catch (error) {
        setNotice({ type: "error", text: parseAPIError(error) });
      }
    },
    [loadRuns]
  );

  const clearEditor = useCallback(() => {
    setSelectedJobId(null);
    setJobForm(buildDefaultForm());
    setSelectedRunId(null);
    setRunOutput("");
  }, []);

  const onSaveJob = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setBusy(true);
      setNotice(null);

      try {
        let payload: Record<string, unknown>;
        if (jobForm.type === "shell") {
          payload = { command: jobForm.shellCommand.trim() };
        } else {
          const headers = jobForm.httpHeaders.trim()
            ? (JSON.parse(jobForm.httpHeaders) as Record<string, string>)
            : {};
          payload = {
            method: jobForm.httpMethod.trim() || "GET",
            url: jobForm.httpURL.trim(),
            headers,
            body: jobForm.httpBody
          };
        }

        const req: JobUpsertPayload = {
          name: jobForm.name.trim(),
          type: jobForm.type,
          schedule: jobForm.schedule.trim(),
          timezone: jobForm.timezone.trim(),
          enabled: jobForm.enabled,
          payload,
          timeout_sec: Number(jobForm.timeoutSec),
          retry_max: Number(jobForm.retryMax),
          retry_backoff_sec: Number(jobForm.retryBackoffSec),
          overlap_policy: jobForm.overlapPolicy
        };

        if (selectedJobId) {
          await api.updateJob(selectedJobId, req);
          setNotice({ type: "info", text: "job_updated" });
        } else {
          const created = await api.createJob(req);
          setSelectedJobId(created.id);
          setNotice({ type: "info", text: "job_created" });
        }
        await loadJobs();
        if (selectedJobId) await loadRuns(selectedJobId);
      } catch (error) {
        setNotice({ type: "error", text: parseAPIError(error) });
      } finally {
        setBusy(false);
      }
    },
    [jobForm, loadJobs, loadRuns, selectedJobId]
  );

  const runNow = useCallback(
    async (jobID: string) => {
      setBusy(true);
      setNotice(null);
      try {
        const response = await api.runJobNow(jobID);
        setPanel("runs");
        if (selectedJobId !== jobID) {
          setSelectedJobId(jobID);
        }
        await loadRuns(jobID);
        setSelectedRunId(response.run_id);
        setNotice({ type: "info", text: "run_enqueued" });
      } catch (error) {
        setNotice({ type: "error", text: parseAPIError(error) });
      } finally {
        setBusy(false);
      }
    },
    [loadRuns, selectedJobId]
  );

  const pauseOrResume = useCallback(
    async (job: Job) => {
      setBusy(true);
      setNotice(null);
      try {
        if (job.enabled) {
          await api.pauseJob(job.id);
          setNotice({ type: "info", text: "job_paused" });
        } else {
          await api.resumeJob(job.id);
          setNotice({ type: "info", text: "job_resumed" });
        }
        await loadJobs();
      } catch (error) {
        setNotice({ type: "error", text: parseAPIError(error) });
      } finally {
        setBusy(false);
      }
    },
    [loadJobs]
  );

  const deleteJob = useCallback(
    async (jobID: string) => {
      if (!window.confirm("Delete this job and all related run history?")) return;
      setBusy(true);
      setNotice(null);
      try {
        await api.deleteJob(jobID);
        if (selectedJobId === jobID) clearEditor();
        await loadJobs();
        setNotice({ type: "info", text: "job_deleted" });
      } catch (error) {
        setNotice({ type: "error", text: parseAPIError(error) });
      } finally {
        setBusy(false);
      }
    },
    [clearEditor, loadJobs, selectedJobId]
  );

  const cancelRunning = useCallback(async () => {
    if (!selectedJobId) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await api.cancelRunningByJob(selectedJobId);
      await loadRuns(selectedJobId);
      setNotice({ type: "info", text: `cancelled_runs_${response.cancelled_runs}` });
    } catch (error) {
      setNotice({ type: "error", text: parseAPIError(error) });
    } finally {
      setBusy(false);
    }
  }, [loadRuns, selectedJobId]);

  const loadRunOutput = useCallback(async (runID: string) => {
    setSelectedRunId(runID);
    try {
      const output = await api.getRunOutput(runID);
      setRunOutput(output);
    } catch (error) {
      setRunOutput("");
      setNotice({ type: "error", text: parseAPIError(error) });
    }
  }, []);

  const onPurge = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await api.purge({
        older_than_days: purgeDays,
        success_only: purgeSuccessOnly
      });
      await Promise.all([loadStorage(), loadJobs()]);
      if (selectedJobId) await loadRuns(selectedJobId);
      setNotice({
        type: "info",
        text: `purged_runs_${result.deleted_runs}_files_${result.deleted_output_files}`
      });
    } catch (error) {
      setNotice({ type: "error", text: parseAPIError(error) });
    } finally {
      setBusy(false);
    }
  }, [loadJobs, loadRuns, loadStorage, purgeDays, purgeSuccessOnly, selectedJobId]);

  const onSaveRetention = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const saved = await api.updateRetentionSettings(settingsDraft);
      setSettings((previous) => ({
        retention_days: saved.retention_days,
        max_log_bytes: saved.max_log_bytes,
        global_concurrency: saved.global_concurrency,
        alert_webhook_url: previous?.alert_webhook_url ?? ""
      }));
      await loadStorage();
      setNotice({ type: "info", text: "settings_updated" });
    } catch (error) {
      setNotice({ type: "error", text: parseAPIError(error) });
    } finally {
      setBusy(false);
    }
  }, [loadStorage, settingsDraft]);

  const onSaveAlerts = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const saved = await api.updateAlertsSettings(alertWebhookDraft.trim());
      setSettings((previous) =>
        previous
          ? { ...previous, alert_webhook_url: saved.alert_webhook_url }
          : {
              retention_days: settingsDraft.retention_days,
              max_log_bytes: settingsDraft.max_log_bytes,
              global_concurrency: settingsDraft.global_concurrency,
              alert_webhook_url: saved.alert_webhook_url
            }
      );
      setNotice({ type: "info", text: "alert_webhook_updated" });
    } catch (error) {
      setNotice({ type: "error", text: parseAPIError(error) });
    } finally {
      setBusy(false);
    }
  }, [alertWebhookDraft, settingsDraft]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_90%_5%,#d4ede9,transparent_28%),radial-gradient(circle_at_10%_20%,#dce7f5,transparent_30%),#eef4f8] text-ink">
      <header className="border-b border-edge/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1320px] items-center justify-between px-4 py-3 md:px-6">
          <div>
            <p className="font-display text-2xl leading-none">Cronye Local UI</p>
            <p className="text-sm text-slate">Daemon health: {healthStatus}</p>
          </div>
          <button
            className="rounded-full border border-edge bg-panel px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
            onClick={() => void loadAll()}
            disabled={busy}
            type="button"
          >
            Refresh
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1320px] gap-4 px-4 py-4 md:px-6 lg:grid-cols-[390px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-edge bg-panel p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl">Jobs</h2>
              <button
                className="rounded-full border border-edge px-3 py-1 text-xs font-semibold hover:border-accent hover:text-accent"
                onClick={clearEditor}
                type="button"
              >
                New
              </button>
            </div>

            <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => void selectJob(job)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedJobId === job.id
                      ? "border-accent bg-accent/5"
                      : "border-edge bg-white hover:border-accent/60"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-semibold">{job.name}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        job.enabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {job.enabled ? "enabled" : "paused"}
                    </span>
                  </div>
                  <p className="text-xs text-slate">
                    {job.type} • {job.schedule}
                  </p>
                  <p className="text-xs text-slate">next: {formatDate(job.next_run_at)}</p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-edge px-2 py-1 text-[11px] hover:border-accent hover:text-accent"
                      onClick={(event) => {
                        event.stopPropagation();
                        void runNow(job.id);
                      }}
                    >
                      Run now
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-edge px-2 py-1 text-[11px] hover:border-accent hover:text-accent"
                      onClick={(event) => {
                        event.stopPropagation();
                        void pauseOrResume(job);
                      }}
                    >
                      {job.enabled ? "Pause" : "Resume"}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-red-300 px-2 py-1 text-[11px] text-danger hover:bg-red-50"
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteJob(job.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </button>
              ))}
              {jobs.length === 0 && <p className="text-sm text-slate">No jobs yet.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-edge bg-panel p-4 shadow-card">
            <h2 className="mb-3 font-display text-xl">
              {selectedJobId ? "Edit Job" : "Create Job"}
            </h2>
            <form className="space-y-3" onSubmit={(event) => void onSaveJob(event)}>
              <label className="block text-sm">
                <span className="mb-1 block text-slate">Name</span>
                <input
                  className="w-full rounded-xl border border-edge bg-white px-3 py-2"
                  value={jobForm.name}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-slate">Type</span>
                  <select
                    className="w-full rounded-xl border border-edge bg-white px-3 py-2"
                    value={jobForm.type}
                    onChange={(event) =>
                      setJobForm((prev) => ({ ...prev, type: event.target.value as JobType }))
                    }
                  >
                    <option value="shell">shell</option>
                    <option value="http">http</option>
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-slate">Overlap</span>
                  <select
                    className="w-full rounded-xl border border-edge bg-white px-3 py-2"
                    value={jobForm.overlapPolicy}
                    onChange={(event) =>
                      setJobForm((prev) => ({
                        ...prev,
                        overlapPolicy: event.target.value as OverlapPolicy
                      }))
                    }
                  >
                    <option value="skip">skip</option>
                    <option value="allow">allow</option>
                  </select>
                </label>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block text-slate">Schedule (cron)</span>
                <input
                  className="w-full rounded-xl border border-edge bg-white px-3 py-2 font-mono"
                  value={jobForm.schedule}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, schedule: event.target.value }))}
                  required
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-slate">Timezone</span>
                <input
                  className="w-full rounded-xl border border-edge bg-white px-3 py-2"
                  list="timezone-list"
                  value={jobForm.timezone}
                  onChange={(event) => setJobForm((prev) => ({ ...prev, timezone: event.target.value }))}
                  required
                />
                <datalist id="timezone-list">
                  {timezoneOptions.map((timezone) => (
                    <option key={timezone} value={timezone} />
                  ))}
                </datalist>
              </label>

              <div className="grid grid-cols-3 gap-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-slate">Timeout (s)</span>
                  <input
                    className="w-full rounded-xl border border-edge bg-white px-3 py-2"
                    type="number"
                    min={1}
                    value={jobForm.timeoutSec}
                    onChange={(event) =>
                      setJobForm((prev) => ({ ...prev, timeoutSec: Number(event.target.value) }))
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-slate">Retry max</span>
                  <input
                    className="w-full rounded-xl border border-edge bg-white px-3 py-2"
                    type="number"
                    min={0}
                    value={jobForm.retryMax}
                    onChange={(event) =>
                      setJobForm((prev) => ({ ...prev, retryMax: Number(event.target.value) }))
                    }
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block text-slate">Backoff (s)</span>
                  <input
                    className="w-full rounded-xl border border-edge bg-white px-3 py-2"
                    type="number"
                    min={0}
                    value={jobForm.retryBackoffSec}
                    onChange={(event) =>
                      setJobForm((prev) => ({
                        ...prev,
                        retryBackoffSec: Number(event.target.value)
                      }))
                    }
                  />
                </label>
              </div>

              {jobForm.type === "shell" ? (
                <label className="block text-sm">
                  <span className="mb-1 block text-slate">Command</span>
                  <textarea
                    className="min-h-24 w-full rounded-xl border border-edge bg-white px-3 py-2 font-mono"
                    value={jobForm.shellCommand}
                    onChange={(event) =>
                      setJobForm((prev) => ({ ...prev, shellCommand: event.target.value }))
                    }
                    required
                  />
                </label>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-[110px_1fr] gap-3">
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate">Method</span>
                      <input
                        className="w-full rounded-xl border border-edge bg-white px-3 py-2"
                        value={jobForm.httpMethod}
                        onChange={(event) =>
                          setJobForm((prev) => ({ ...prev, httpMethod: event.target.value }))
                        }
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate">URL</span>
                      <input
                        className="w-full rounded-xl border border-edge bg-white px-3 py-2"
                        value={jobForm.httpURL}
                        onChange={(event) =>
                          setJobForm((prev) => ({ ...prev, httpURL: event.target.value }))
                        }
                        required
                      />
                    </label>
                  </div>

                  <label className="block text-sm">
                    <span className="mb-1 block text-slate">Headers (JSON object)</span>
                    <textarea
                      className="min-h-24 w-full rounded-xl border border-edge bg-white px-3 py-2 font-mono"
                      value={jobForm.httpHeaders}
                      onChange={(event) =>
                        setJobForm((prev) => ({ ...prev, httpHeaders: event.target.value }))
                      }
                    />
                  </label>

                  <label className="block text-sm">
                    <span className="mb-1 block text-slate">Body</span>
                    <textarea
                      className="min-h-24 w-full rounded-xl border border-edge bg-white px-3 py-2 font-mono"
                      value={jobForm.httpBody}
                      onChange={(event) =>
                        setJobForm((prev) => ({ ...prev, httpBody: event.target.value }))
                      }
                    />
                  </label>
                </div>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={jobForm.enabled}
                  onChange={(event) =>
                    setJobForm((prev) => ({ ...prev, enabled: event.target.checked }))
                  }
                />
                <span>Enabled</span>
              </label>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-accent px-4 py-2 font-semibold text-white hover:bg-accentStrong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {selectedJobId ? "Save Changes" : "Create Job"}
              </button>
            </form>
          </section>
        </aside>

        <section className="space-y-4">
          <nav className="rounded-2xl border border-edge bg-panel p-2 shadow-card">
            <div className="flex gap-2">
              {(["runs", "storage", "settings"] as const).map((name) => (
                <button
                  key={name}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                    panel === name ? "bg-accent text-white" : "hover:bg-mist"
                  }`}
                  onClick={() => setPanel(name)}
                  type="button"
                >
                  {name}
                </button>
              ))}
            </div>
          </nav>

          {notice && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                notice.type === "error"
                  ? "border-red-300 bg-red-50 text-red-800"
                  : "border-emerald-300 bg-emerald-50 text-emerald-800"
              }`}
            >
              {notice.text}
            </div>
          )}

          {panel === "runs" && (
            <section className="rounded-2xl border border-edge bg-panel p-4 shadow-card">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-xl">Run History</h2>
                <div className="flex gap-2">
                  <select
                    className="rounded-xl border border-edge px-3 py-2 text-sm"
                    value={runFilter}
                    onChange={(event) => setRunFilter(event.target.value as RunFilter)}
                  >
                    <option value="all">all</option>
                    <option value="queued">queued</option>
                    <option value="running">running</option>
                    <option value="success">success</option>
                    <option value="failed">failed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                  <button
                    className="rounded-xl border border-edge px-3 py-2 text-sm hover:border-accent hover:text-accent"
                    onClick={() => selectedJobId && void loadRuns(selectedJobId)}
                    type="button"
                    disabled={!selectedJobId}
                  >
                    Refresh runs
                  </button>
                  <button
                    className="rounded-xl border border-red-300 px-3 py-2 text-sm text-danger hover:bg-red-50"
                    onClick={() => void cancelRunning()}
                    type="button"
                    disabled={!selectedJobId}
                  >
                    Cancel running
                  </button>
                </div>
              </div>

              {!selectedJob ? (
                <p className="text-slate">Select a job to view run history.</p>
              ) : (
                <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
                  <div className="overflow-hidden rounded-xl border border-edge">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-mist">
                        <tr>
                          <th className="px-3 py-2">status</th>
                          <th className="px-3 py-2">attempt</th>
                          <th className="px-3 py-2">started</th>
                          <th className="px-3 py-2">duration</th>
                          <th className="px-3 py-2">output</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRuns.map((run) => (
                          <tr
                            key={run.id}
                            className={`cursor-pointer border-t border-edge hover:bg-mist/50 ${
                              selectedRunId === run.id ? "bg-mist/80" : ""
                            }`}
                            onClick={() => {
                              setSelectedRunId(run.id);
                              setRunOutput(run.output_tail ?? "");
                            }}
                          >
                            <td className="px-3 py-2">
                              <span className={`rounded-full px-2 py-0.5 text-xs ${statusTone(run.status)}`}>
                                {run.status}
                              </span>
                            </td>
                            <td className="px-3 py-2">{run.attempt}</td>
                            <td className="px-3 py-2">{formatDate(run.started_at || run.scheduled_at)}</td>
                            <td className="px-3 py-2">
                              {run.duration_ms !== null && run.duration_ms !== undefined
                                ? `${run.duration_ms} ms`
                                : "-"}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                className="rounded-lg border border-edge px-2 py-1 text-xs hover:border-accent hover:text-accent"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void loadRunOutput(run.id);
                                }}
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filteredRuns.length === 0 && (
                          <tr>
                            <td className="px-3 py-4 text-slate" colSpan={5}>
                              No runs for this filter.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <article className="rounded-xl border border-edge p-3">
                    <h3 className="mb-2 font-semibold">Run Output</h3>
                    {selectedRunId ? (
                      <>
                        <p className="mb-2 text-xs text-slate">run id: {selectedRunId}</p>
                        <pre className="max-h-[420px] overflow-auto rounded-lg bg-[#0f1721] p-3 text-xs text-slate-100">
                          {runOutput || "No output captured yet."}
                        </pre>
                      </>
                    ) : (
                      <p className="text-slate">Select a run and click View output.</p>
                    )}
                  </article>
                </div>
              )}
            </section>
          )}

          {panel === "storage" && (
            <section className="rounded-2xl border border-edge bg-panel p-4 shadow-card">
              <h2 className="mb-3 font-display text-xl">Storage Dashboard</h2>

              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-edge p-3">
                  <p className="text-xs text-slate">DB size</p>
                  <p className="font-semibold">{formatBytes(storage?.db_bytes)}</p>
                </div>
                <div className="rounded-xl border border-edge p-3">
                  <p className="text-xs text-slate">Run outputs</p>
                  <p className="font-semibold">{formatBytes(storage?.run_output_bytes)}</p>
                </div>
                <div className="rounded-xl border border-edge p-3">
                  <p className="text-xs text-slate">Total</p>
                  <p className="font-semibold">{formatBytes(storage?.total_bytes)}</p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[190px_1fr_auto]">
                <label className="block text-sm">
                  <span className="mb-1 block text-slate">Older than days</span>
                  <input
                    className="w-full rounded-xl border border-edge px-3 py-2"
                    type="number"
                    min={1}
                    value={purgeDays}
                    onChange={(event) => setPurgeDays(Number(event.target.value))}
                  />
                </label>
                <label className="mt-6 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={purgeSuccessOnly}
                    onChange={(event) => setPurgeSuccessOnly(event.target.checked)}
                  />
                  <span>Purge successful runs only</span>
                </label>
                <button
                  type="button"
                  className="mt-6 rounded-xl bg-accent px-4 py-2 font-semibold text-white hover:bg-accentStrong"
                  onClick={() => void onPurge()}
                >
                  Purge now
                </button>
              </div>
            </section>
          )}

          {panel === "settings" && (
            <section className="rounded-2xl border border-edge bg-panel p-4 shadow-card">
              <h2 className="mb-3 font-display text-xl">Settings</h2>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="block text-sm">
                  <span className="mb-1 block text-slate">Retention days</span>
                  <input
                    className="w-full rounded-xl border border-edge px-3 py-2"
                    type="number"
                    min={1}
                    value={settingsDraft.retention_days}
                    onChange={(event) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        retention_days: Number(event.target.value)
                      }))
                    }
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-slate">Max log bytes</span>
                  <input
                    className="w-full rounded-xl border border-edge px-3 py-2"
                    type="number"
                    min={1}
                    value={settingsDraft.max_log_bytes}
                    onChange={(event) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        max_log_bytes: Number(event.target.value)
                      }))
                    }
                  />
                </label>

                <label className="block text-sm">
                  <span className="mb-1 block text-slate">Global concurrency</span>
                  <select
                    className="w-full rounded-xl border border-edge px-3 py-2"
                    value={settingsDraft.global_concurrency}
                    onChange={(event) =>
                      setSettingsDraft((prev) => ({
                        ...prev,
                        global_concurrency: Number(event.target.value) as 1 | 2
                      }))
                    }
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                  </select>
                </label>
              </div>

              <button
                type="button"
                className="mt-3 rounded-xl bg-accent px-4 py-2 font-semibold text-white hover:bg-accentStrong"
                onClick={() => void onSaveRetention()}
              >
                Save retention settings
              </button>

              <div className="mt-5 border-t border-edge pt-4">
                <label className="block text-sm">
                  <span className="mb-1 block text-slate">Failure alert webhook URL</span>
                  <input
                    className="w-full rounded-xl border border-edge px-3 py-2"
                    value={alertWebhookDraft}
                    onChange={(event) => setAlertWebhookDraft(event.target.value)}
                    placeholder="https://example.com/webhook"
                  />
                </label>
                <button
                  type="button"
                  className="mt-3 rounded-xl bg-accent px-4 py-2 font-semibold text-white hover:bg-accentStrong"
                  onClick={() => void onSaveAlerts()}
                >
                  Save alert webhook
                </button>
                <p className="mt-2 text-xs text-slate">
                  Current: {settings?.alert_webhook_url ? settings.alert_webhook_url : "(not set)"}
                </p>
              </div>
            </section>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
