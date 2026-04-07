import React, { useEffect, useMemo, useState } from "react";
import {
  mapRepoErrorForAdmin,
  type RepoErrorDetail,
} from "../../lib/repository/types";

declare global {
  interface Window {
    __repoErrors?: RepoErrorDetail[];
  }
}

const MAX_ERRORS = 200;

export default function RepoErrorPanel() {
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<RepoErrorDetail[]>(
    () => window.__repoErrors || []
  );

  useEffect(() => {
    const onNew = (e: Event) => {
      const detail = (e as CustomEvent<RepoErrorDetail>).detail;
      if (!detail) return;
      setErrors((prev) => {
        const next = [...prev, detail];
        return next.slice(-MAX_ERRORS);
      });
    };
    window.addEventListener("repo-error", onNew as EventListener);
    // Sync initial on mount in case some errors happened before
    setErrors((window.__repoErrors || []).slice(-MAX_ERRORS));
    return () =>
      window.removeEventListener("repo-error", onNew as EventListener);
  }, []);

  const count = errors.length;
  const last5 = useMemo(() => errors.slice(-5).reverse(), [errors]);

  const clear = () => {
    window.__repoErrors = [];
    setErrors([]);
  };

  const copy = async () => {
    const payload = errors.map((e) => ({
      code: e.code,
      message: e.message,
      cause: e.cause?.message || e.cause || null,
    }));
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    } catch {}
  };

  // Hidden entirely in production
  if (!(import.meta as any)?.env?.DEV) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[1000] text-sm">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`px-3 py-2 rounded-md shadow border transition ${
          count > 0
            ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
        }`}
        title="Mở bảng lỗi Repo (dev only)"
      >
        Repo Errors {count > 0 ? `(${count})` : ""}
      </button>

      {/* Panel */}
      {open && (
        <div className="mt-2 w-[480px] max-h-[50vh] overflow-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-slate-800 dark:text-slate-100">
              Repository Errors ({count})
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copy}
                className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Copy JSON
              </button>
              <button
                onClick={clear}
                className="px-2 py-1 text-xs rounded border border-slate-200 hover:bg-slate-50 text-red-600 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Clear
              </button>
            </div>
          </div>

          {count === 0 ? (
            <div className="text-slate-500">Không có lỗi</div>
          ) : (
            <ul className="space-y-2">
              {last5.map((e, idx) => (
                <li
                  key={idx}
                  className="p-2 rounded border bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                >
                  <div className="text-xs font-mono text-slate-700 dark:text-slate-200 break-words">
                    {mapRepoErrorForAdmin(e)}
                  </div>
                  {e.cause && (
                    <pre className="mt-1 text-[11px] whitespace-pre-wrap break-words text-slate-500">
                      {typeof e.cause === "string"
                        ? e.cause
                        : e.cause?.message || JSON.stringify(e.cause)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
