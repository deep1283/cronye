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
    schedule: "0 * * * *",
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
  const knownErrors: Record<string, string> = {
    internal_error: "Something went wrong on the local daemon. Please try again.",
    job_not_found: "This job was not found. Refresh the page and try again.",
    run_not_found: "This run was not found. Refresh run history and try again.",
    run_id_required: "Run ID is required.",
    scheduler_reload_failed: "The scheduler could not be reloaded. Please try once more.",
    runner_unavailable: "Runner is not available right now. Restart Cronye and try again.",
    older_than_days_must_be_positive: "Older than days must be greater than 0.",
    keep_recent_must_be_non_negative: "Keep latest runs must be 0 or more.",
    retention_days_must_be_positive: "Retention days must be greater than 0.",
    max_log_bytes_must_be_positive: "Max log bytes must be greater than 0."
  };

  if (error instanceof APIError) {
    if (knownErrors[error.message]) return knownErrors[error.message];
    if (error.message.startsWith("request_failed_")) {
      return `Request failed (${error.status}). Please try again.`;
    }
    return error.message.replaceAll("_", " ");
  }
  if (error instanceof Error) {
    if (error.name === "SyntaxError") {
      return "Please check your JSON input. It must be valid JSON.";
    }
    return error.message;
  }
  return "Unknown error. Please try again.";
}

function statusTone(status: string) {
  if (status === "success") return "bg-emerald-100 text-emerald-800";
  if (status === "running") return "bg-sky-100 text-sky-800";
  if (status === "queued") return "bg-amber-100 text-amber-800";
  if (status === "cancelled" || status === "skipped_overlap") return "bg-slate-200 text-slate-800";
  return "bg-red-100 text-red-800";
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
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
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [jobForm, setJobForm] = useState<JobFormState>(buildDefaultForm());
  const [runsViewLimit, setRunsViewLimit] = useState<number>(100);
  const [runCleanupKeepRecent, setRunCleanupKeepRecent] = useState<number>(100);
  const [runCleanupSuccessOnly, setRunCleanupSuccessOnly] = useState<boolean>(false);
  const [purgeDays, setPurgeDays] = useState<number>(30);
  const [purgeSuccessOnly, setPurgeSuccessOnly] = useState<boolean>(false);
  const [settingsDraft, setSettingsDraft] = useState({
    retention_days: 30,
    max_log_bytes: 1_073_741_824,
    global_concurrency: 1 as 1 | 2
  });

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );
  const startupCatchup = settings?.startup_catchup;

  const filteredRuns = useMemo(() => {
    if (runFilter === "all") return runs;
    return runs.filter((run) => run.status === runFilter);
  }, [runs, runFilter]);

  const visibleRuns = useMemo(() => {
    return filteredRuns.slice(0, runsViewLimit);
  }, [filteredRuns, runsViewLimit]);

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
  }, []);

  const loadAll = useCallback(async () => {
    setPendingAction("refresh");
    setBusy(true);
    setNotice(null);
    try {
      await loadHealth();
      await Promise.all([loadJobs(), loadStorage(), loadSettings()]);
      if (selectedJobId) {
        await loadRuns(selectedJobId);
      }
    } catch (error) {
      setNotice({ type: "error", text: parseAPIError(error) });
    } finally {
      setPendingAction(null);
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
      setPendingAction("job:save");
      setBusy(true);
      setNotice(null);

      try {
        let payload: Record<string, unknown>;
        if (jobForm.type === "shell") {
          payload = { command: jobForm.shellCommand.trim() };
        } else {
          let headers: Record<string, string> = {};
          if (jobForm.httpHeaders.trim()) {
            try {
              headers = JSON.parse(jobForm.httpHeaders) as Record<string, string>;
            } catch {
              setNotice({ type: "error", text: "Headers must be valid JSON." });
              return;
            }
          }
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

        let targetJobID = selectedJobId;
        if (selectedJobId) {
          await api.updateJob(selectedJobId, req);
          setNotice({ type: "info", text: `Saved changes for "${jobForm.name.trim()}".` });
        } else {
          const created = await api.createJob(req);
          setSelectedJobId(created.id);
          targetJobID = created.id;
          setNotice({ type: "info", text: `Created "${jobForm.name.trim()}". You can run it now.` });
        }
        await loadJobs();
        if (targetJobID) await loadRuns(targetJobID);
      } catch (error) {
        setNotice({ type: "error", text: parseAPIError(error) });
      } finally {
        setPendingAction(null);
        setBusy(false);
      }
    },
    [jobForm, loadJobs, loadRuns, selectedJobId]
  );

  const runNow = useCallback(
    async (jobID: string) => {
      setPendingAction(`job:run:${jobID}`);
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
        setNotice({ type: "info", text: "Run queued. Open View to check output." });
      } catch (error) {
        setNotice({ type: "error", text: parseAPIError(error) });
      } finally {
        setPendingAction(null);
        setBusy(false);
      }
    },
    [loadRuns, selectedJobId]
  );

  const pauseOrResume = useCallback(
    async (job: Job) => {
      setPendingAction(`job:toggle:${job.id}`);
      setBusy(true);
      setNotice(null);
      try {
        if (job.enabled) {
          await api.pauseJob(job.id);
          setNotice({ type: "info", text: `"${job.name}" paused. Scheduled runs are stopped.` });
        } else {
          await api.resumeJob(job.id);
          setNotice({ type: "info", text: `"${job.name}" resumed.` });
        }
        await loadJobs();
      } catch (error) {
        setNotice({ type: "error", text: parseAPIError(error) });
      } finally {
        setPendingAction(null);
        setBusy(false);
      }
    },
    [loadJobs]
  );

  const deleteJob = useCallback(
    async (jobID: string) => {
      if (!window.confirm("Delete this job and all related run history?")) return;
      setPendingAction(`job:delete:${jobID}`);
      setBusy(true);
      setNotice(null);
      try {
        await api.deleteJob(jobID);
        if (selectedJobId === jobID) clearEditor();
        await loadJobs();
        setNotice({ type: "info", text: "Job deleted." });
      } catch (error) {
        setNotice({ type: "error", text: parseAPIError(error) });
      } finally {
        setPendingAction(null);
        setBusy(false);
      }
    },
    [clearEditor, loadJobs, selectedJobId]
  );

  const cancelRunning = useCallback(async () => {
    if (!selectedJobId) return;
    setPendingAction("runs:cancel");
    setBusy(true);
    setNotice(null);
    try {
      const response = await api.cancelRunningByJob(selectedJobId);
      await loadRuns(selectedJobId);
      if (response.cancelled_runs === 0) {
        setNotice({ type: "info", text: "No running job was found to cancel." });
      } else {
        setNotice({
          type: "info",
          text: `Cancellation sent for ${response.cancelled_runs} running execution(s).`
        });
      }
    } catch (error) {
      setNotice({ type: "error", text: parseAPIError(error) });
    } finally {
      setPendingAction(null);
      setBusy(false);
    }
  }, [loadRuns, selectedJobId]);

  const refreshRuns = useCallback(async () => {
    if (!selectedJobId) return;
    setPendingAction("runs:refresh");
    setBusy(true);
    try {
      await loadRuns(selectedJobId);
    } catch (error) {
      setNotice({ type: "error", text: parseAPIError(error) });
    } finally {
      setPendingAction(null);
      setBusy(false);
    }
  }, [loadRuns, selectedJobId]);

  const deleteRun = useCallback(
    async (runID: string) => {
      const confirmed = window.confirm("Delete this run from history?");
      if (!confirmed) return;

      setPendingAction(`run:delete:${runID}`);
      setBusy(true);
      setNotice(null);
      try {
        const result = await api.deleteRun(runID);
        if (selectedRunId === runID) {
          setSelectedRunId(null);
          setRunOutput("");
        }
        if (selectedJobId) {
          await loadRuns(selectedJobId);
        }
        await loadStorage();
        setNotice({
          type: "info",
          text: `Removed 1 run from history${result.deleted_output_files > 0 ? " and cleaned output file." : "."}`
        });
      } catch (error) {
        setNotice({ type: "error", text: parseAPIError(error) });
      } finally {
        setPendingAction(null);
        setBusy(false);
      }
    },
    [loadRuns, loadStorage, selectedJobId, selectedRunId]
  );

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
    setPendingAction("storage:purge");
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
        text: `Purged ${result.deleted_runs} runs and ${result.deleted_output_files} output file(s).`
      });
    } catch (error) {
      setNotice({ type: "error", text: parseAPIError(error) });
    } finally {
      setPendingAction(null);
      setBusy(false);
    }
  }, [loadJobs, loadRuns, loadStorage, purgeDays, purgeSuccessOnly, selectedJobId]);

  const onPurgeJobRuns = useCallback(async () => {
    if (!selectedJobId) return;
    if (runCleanupKeepRecent < 0) {
      setNotice({ type: "error", text: "Keep latest runs must be 0 or more." });
      return;
    }

    const confirmed = window.confirm(
      `This will remove old run history and keep the latest ${runCleanupKeepRecent} run(s) for this job. Continue?`
    );
    if (!confirmed) return;

    setPendingAction("runs:cleanup");
    setBusy(true);
    setNotice(null);
    try {
      const result = await api.purgeJobRuns(selectedJobId, {
        keep_recent: runCleanupKeepRecent,
        success_only: runCleanupSuccessOnly
      });
      await Promise.all([loadRuns(selectedJobId), loadStorage()]);
      if (result.deleted_runs === 0) {
        setNotice({
          type: "info",
          text: `Nothing to clean. Already keeping the latest ${runCleanupKeepRecent} run(s).`
        });
      } else {
        setNotice({
          type: "info",
          text: `Removed ${result.deleted_runs} old run(s). Keeping latest ${runCleanupKeepRecent}.`
        });
      }
    } catch (error) {
      setNotice({ type: "error", text: parseAPIError(error) });
    } finally {
      setPendingAction(null);
      setBusy(false);
    }
  }, [loadRuns, loadStorage, runCleanupKeepRecent, runCleanupSuccessOnly, selectedJobId]);

  const onSaveRetention = useCallback(async () => {
    setPendingAction("settings:retention");
    setBusy(true);
    setNotice(null);
    try {
      const saved = await api.updateRetentionSettings(settingsDraft);
      setSettings((previous) => ({
        retention_days: saved.retention_days,
        max_log_bytes: saved.max_log_bytes,
        global_concurrency: saved.global_concurrency,
        alert_webhook_url: previous?.alert_webhook_url ?? "",
        startup_catchup: previous?.startup_catchup
      }));
      await loadStorage();
      setNotice({ type: "info", text: "Retention settings saved." });
    } catch (error) {
      setNotice({ type: "error", text: parseAPIError(error) });
    } finally {
      setPendingAction(null);
      setBusy(false);
    }
  }, [loadStorage, settingsDraft]);

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
            {pendingAction === "refresh" ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-[1320px] gap-4 px-4 py-4 md:px-6 lg:grid-cols-[390px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-edge bg-panel p-4 shadow-card">
            <h2 className="mb-3 font-display text-xl">Quick Start</h2>
            <ol className="space-y-2 text-sm text-slate">
              <li>1. Fill the form manually.</li>
              <li>2. Click <strong>Create Job</strong>.</li>
              <li>3. In the Jobs list, click <strong>Run now</strong>.</li>
              <li>4. Open <strong>Run History</strong> and click <strong>View</strong> to see output.</li>
            </ol>
          </section>

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
                      disabled={busy}
                      onClick={(event) => {
                        event.stopPropagation();
                        void runNow(job.id);
                      }}
                    >
                      {pendingAction === `job:run:${job.id}` ? "Queueing..." : "Run now"}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-edge px-2 py-1 text-[11px] hover:border-accent hover:text-accent"
                      disabled={busy}
                      onClick={(event) => {
                        event.stopPropagation();
                        void pauseOrResume(job);
                      }}
                    >
                      {pendingAction === `job:toggle:${job.id}`
                        ? job.enabled
                          ? "Pausing..."
                          : "Resuming..."
                        : job.enabled
                          ? "Pause"
                          : "Resume"}
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-red-300 px-2 py-1 text-[11px] text-danger hover:bg-red-50"
                      disabled={busy}
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteJob(job.id);
                      }}
                    >
                      {pendingAction === `job:delete:${job.id}` ? "Deleting..." : "Delete job"}
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
                  placeholder="Example: Every 5 min health check"
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
                <p className="mt-1 text-xs text-slate">
                  Example: <code>0 * * * *</code> runs once every hour.
                </p>
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
                    placeholder='echo "Cronye is running"'
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
                {pendingAction === "job:save"
                  ? selectedJobId
                    ? "Saving..."
                    : "Creating..."
                  : selectedJobId
                    ? "Save Changes"
                    : "Create Job"}
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
                    value={runsViewLimit}
                    onChange={(event) => setRunsViewLimit(Number(event.target.value))}
                  >
                    <option value={25}>show 25</option>
                    <option value={50}>show 50</option>
                    <option value={100}>show 100</option>
                    <option value={200}>show 200</option>
                    <option value={500}>show 500</option>
                  </select>
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
                    onClick={() => void refreshRuns()}
                    type="button"
                    disabled={!selectedJobId || busy}
                  >
                    {pendingAction === "runs:refresh" ? "Refreshing..." : "Refresh runs"}
                  </button>
                  <button
                    className="rounded-xl border border-red-300 px-3 py-2 text-sm text-danger hover:bg-red-50"
                    onClick={() => void cancelRunning()}
                    type="button"
                    disabled={!selectedJobId || busy}
                  >
                    {pendingAction === "runs:cancel" ? "Cancelling..." : "Cancel active run"}
                  </button>
                </div>
              </div>

              {selectedJob && (
                <div className="mb-3 rounded-xl border border-edge bg-white p-3">
                  <div className="grid gap-2 md:grid-cols-[170px_1fr_auto]">
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate">Keep latest runs</span>
                      <input
                        className="w-full rounded-xl border border-edge px-3 py-2"
                        type="number"
                        min={0}
                        value={runCleanupKeepRecent}
                        onChange={(event) => setRunCleanupKeepRecent(Number(event.target.value))}
                      />
                    </label>
                    <label className="mt-6 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={runCleanupSuccessOnly}
                        onChange={(event) => setRunCleanupSuccessOnly(event.target.checked)}
                      />
                      <span>Clean only successful runs</span>
                    </label>
                    <button
                      type="button"
                      className="mt-6 rounded-xl border border-edge px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
                      onClick={() => void onPurgeJobRuns()}
                      disabled={busy}
                    >
                      {pendingAction === "runs:cleanup" ? "Cleaning..." : "Clean history"}
                    </button>
                  </div>
                </div>
              )}

              {!selectedJob ? (
                <div className="rounded-xl border border-edge bg-white p-3 text-sm text-slate">
                  <p className="font-semibold text-ink">How to run your first job</p>
                  <p className="mt-1">Create a job on the left, then click <strong>Run now</strong> in the Jobs list.</p>
                  <p className="mt-1">After that, select the job to view run history and output.</p>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
                  <div>
                    <div className="overflow-x-auto overflow-y-hidden rounded-xl border border-edge">
                      <table className="min-w-[720px] w-full text-left text-sm">
                        <thead className="bg-mist">
                          <tr>
                            <th className="px-3 py-2">status</th>
                            <th className="px-3 py-2">attempt</th>
                            <th className="px-3 py-2">started</th>
                            <th className="px-3 py-2">duration</th>
                            <th className="px-3 py-2">actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleRuns.map((run) => (
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
                                <div className="flex items-center gap-2">
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
                                  <button
                                    type="button"
                                    aria-label="Delete run"
                                    title="Delete this run"
                                    className="rounded-lg border border-red-300 p-1.5 text-danger hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void deleteRun(run.id);
                                    }}
                                    disabled={busy}
                                  >
                                    {pendingAction === `run:delete:${run.id}` ? "..." : <TrashIcon />}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {visibleRuns.length === 0 && (
                            <tr>
                              <td className="px-3 py-4 text-slate" colSpan={5}>
                                No runs for this filter.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-xs text-slate">
                      Showing {visibleRuns.length} of {filteredRuns.length} run(s).
                    </p>
                  </div>

                  <article className="rounded-xl border border-edge p-3">
                    <h3 className="mb-2 font-semibold">Run Output</h3>
                    {selectedRunId ? (
                      <>
                        {runOutput.trim() && (
                          <>
                            <p className="mb-2 text-xs text-slate">run id: {selectedRunId}</p>
                            <pre className="max-h-[420px] overflow-auto rounded-lg bg-[#0f1721] p-3 text-xs text-slate-100">
                              {runOutput}
                            </pre>
                          </>
                        )}
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
                  className="mt-6 rounded-xl bg-accent px-4 py-2 font-semibold text-white hover:bg-accentStrong disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void onPurge()}
                  disabled={busy}
                >
                  {pendingAction === "storage:purge" ? "Purging..." : "Purge now"}
                </button>
              </div>
            </section>
          )}

          {panel === "settings" && (
            <section className="rounded-2xl border border-edge bg-panel p-4 shadow-card">
              <h2 className="mb-3 font-display text-xl">Settings</h2>

              <div className="mb-4 rounded-xl border border-edge bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">Startup Catch-up</p>
                  <p className="text-xs text-slate">
                    last replay: {formatDate(startupCatchup?.last_run_at)}
                  </p>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-lg border border-edge p-2">
                    <p className="text-xs text-slate">Window Start</p>
                    <p className="font-semibold">{formatDate(startupCatchup?.window_start_at)}</p>
                  </div>
                  <div className="rounded-lg border border-edge p-2">
                    <p className="text-xs text-slate">Window End</p>
                    <p className="font-semibold">{formatDate(startupCatchup?.window_end_at)}</p>
                  </div>
                  <div className="rounded-lg border border-edge p-2">
                    <p className="text-xs text-slate">Jobs Scanned</p>
                    <p className="font-semibold">{startupCatchup?.jobs_scanned ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-edge p-2">
                    <p className="text-xs text-slate">Runs Enqueued</p>
                    <p className="font-semibold">{startupCatchup?.runs_enqueued ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-edge p-2">
                    <p className="text-xs text-slate">Skipped Existing</p>
                    <p className="font-semibold">{startupCatchup?.skipped_existing ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-edge p-2">
                    <p className="text-xs text-slate">Truncated Jobs</p>
                    <p className="font-semibold">{startupCatchup?.truncated_jobs ?? 0}</p>
                  </div>
                </div>
              </div>

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
                className="mt-3 rounded-xl bg-accent px-4 py-2 font-semibold text-white hover:bg-accentStrong disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => void onSaveRetention()}
                disabled={busy}
              >
                {pendingAction === "settings:retention" ? "Saving..." : "Save retention settings"}
              </button>

            </section>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
