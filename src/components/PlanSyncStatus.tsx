import React from "react";
import { useStore } from "../store.tsx";

export default function PlanSyncStatus() {
  const s = useStore(), state = s.planSync;
  if (state.phase === "empty") return null;
  const message = state.error || ({ loading: "Loading your cloud plan…", saving: "Saving plan to cloud…",
    saved: "Plan saved to cloud", error: "", conflict: "" })[state.phase];
  return <div className={`plan-sync ${state.error ? "banner" : "muted small"}`} role="status" aria-live="polite">
    {message}
    {state.phase === "error" && <button className="btn small" onClick={() => void s.retryPlan().catch(() => {})}>Retry</button>}
    {state.phase === "conflict" && <button className="btn small" onClick={() => void s.loadCloudPlan()}
      title="Discard unsaved edits on this device and load the newer cloud plan">Load cloud plan</button>}
  </div>;
}
