import React from "react";
import { showToast } from "../../utils/toast";

type State = { hasError: boolean; error?: Error };

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Unhandled UI error:", error, errorInfo);

    // Check for chunk load error (Lazy loading failure due to deployment)
    const isChunkError =
      error.message.includes("Failed to fetch dynamically imported module") ||
      error.message.includes("Importing a module script failed") ||
      error.message.includes("Loading chunk");

    if (isChunkError) {
      console.log("Chunk load error detected. Attempting to reload...");
      // Check last reload to prevent infinite loop
      const lastReload = parseInt(sessionStorage.getItem('last_chunk_error_reload') || '0');
      const now = Date.now();

      // If we haven't reloaded in the last 10 seconds for this reason
      if (now - lastReload > 10000) {
        sessionStorage.setItem('last_chunk_error_reload', now.toString());
        window.location.reload();
        return;
      }
    }

    showToast.error("Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.");
  }

  handleReload = () => {
    this.setState({ hasError: false, error: undefined });

    // Clear Service Worker cache if exists (Force update)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
        // Force reload from server, ignoring cache
        window.location.href = window.location.href.split("?")[0] + "?t=" + Date.now();
      });
    } else {
      // Force reload
      window.location.href = window.location.href.split("?")[0] + "?t=" + Date.now();
    }
  };

  render() {
    if (this.state.hasError) {
      const isChunkError =
        this.state.error?.message.includes("Failed to fetch dynamically imported module") ||
        this.state.error?.message.includes("Importing a module script failed") ||
        this.state.error?.message.includes("Loading chunk");

      return (
        this.props.fallback || (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-xl text-center max-w-md">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                {isChunkError ? "Đang cập nhật phiên bản mới..." : "Có lỗi xảy ra"}
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                {isChunkError
                  ? "Hệ thống đang tự động tải lại để cập nhật tính năng mới."
                  : "Vui lòng tải lại trang hoặc quay lại sau."}
              </p>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                {isChunkError ? "Tải lại ngay" : "Tải lại trang"}
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
