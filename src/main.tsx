import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

try {
  window.sessionStorage.removeItem("motocare-react-activity-recovery-v1");
} catch {
  // Ignore session storage access errors
}

// Hard-disable legacy PWA caching to prevent stale mixed JS chunks in production.
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    (async () => {
      try {
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((reg) => reg.unregister()));
        }

        if ("caches" in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map((name) => caches.delete(name)));
        }
      } catch (err) {
        console.warn("Legacy service worker cleanup failed:", err);
      }
    })();
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <ToastContainer
      position="top-right"
      autoClose={3000}
      hideProgressBar={false}
      newestOnTop={true}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="colored"
    />
  </React.StrictMode>
);
