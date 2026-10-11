import type { PlanItem } from "../engine/types.ts";

export interface CloudPlan { items: PlanItem[]; revision: number }
export interface PlanWrite {
  week_start: string;
  expected_revision: number | null;
  status: "saved";
  items: PlanItem[];
}
export interface PlanSnapshot {
  week: string;
  items: PlanItem[];
  ready: boolean;
  phase: "loading" | "empty" | "saved" | "saving" | "error" | "conflict";
  error: string;
}
interface Dependencies {
  load: (week: string) => Promise<CloudPlan | null>;
  save: (plan: PlanWrite) => Promise<{ revision: number }>;
  week: () => string;
  readLegacy: () => PlanItem[];
  clearLegacy: () => void;
  changed: (snapshot: PlanSnapshot) => void;
}

// Portugal is the app's planning calendar, regardless of a device's timezone.
export function mondayOf(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon",
    year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (name: string) => parts.find((p) => p.type === name)!.value;
  const monday = new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  return monday.toISOString().slice(0, 10);
}

export function readLegacyPlan(storage: Pick<Storage, "getItem">): PlanItem[] {
  try {
    const value = JSON.parse(storage.getItem("plan") || "[]");
    if (!Array.isArray(value) || value.length > 14) return [];
    const slots = new Set<string>();
    for (const item of value) {
      const key = `${item?.day_of_week}:${item?.slot}`;
      if (!item || !Number.isInteger(item.day_of_week) || item.day_of_week < 1 || item.day_of_week > 7 ||
          !["lunch", "dinner"].includes(item.slot) || slots.has(key) ||
          typeof item.is_leftover !== "boolean" || !Number.isSafeInteger(item.servings) || item.servings < 1 ||
          (item.recipe_id !== null && (typeof item.recipe_id !== "string" || !item.recipe_id.trim()))) return [];
      slots.add(key);
    }
    return value;
  } catch { return []; }
}

// One controller owns cloud hydration, ordered writes and the revision last read.
// React only subscribes to its snapshot; refresh never erases pending local edits.
export class PlanSync {
  snapshot: PlanSnapshot;
  private deps: Dependencies;
  private revision: number | null = null;
  private edits = 0;
  private savedEdits = 0;
  private pending: Promise<void> | null = null;
  private refreshing = false;
  private hydrated = false;
  private cloudLoadRequested = false;
  get unsaved() { return this.edits !== this.savedEdits; }

  constructor(deps: Dependencies) {
    this.deps = deps;
    this.snapshot = { week: deps.week(), items: [], ready: false, phase: "loading", error: "" };
  }
  private publish(patch: Partial<PlanSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.deps.changed(this.snapshot);
  }
  private clearLegacy() { try { this.deps.clearLegacy(); } catch {} }

  async refresh(discardLocal = false): Promise<void> {
    if (discardLocal) this.cloudLoadRequested = true;
    discardLocal = this.cloudLoadRequested;
    if (this.refreshing || this.pending || (!discardLocal && this.edits !== this.savedEdits)) return;
    this.refreshing = true;
    const initial = !this.hydrated, edit = this.edits, week = this.deps.week();
    // A returning tab must not let Monday edits land in the previous week while
    // the new week's request is still in flight.
    if (week !== this.snapshot.week || discardLocal)
      this.publish({ ready: false, phase: "loading", error: "" });
    try {
      let plan = await this.deps.load(week);
      if (initial && plan === null) {
        const legacy = this.deps.readLegacy();
        if (legacy.length) {
          this.publish({ items: legacy, phase: "saving" });
          try {
            const result = await this.deps.save({ week_start: week, expected_revision: null,
              status: "saved", items: legacy });
            plan = { items: legacy, revision: result.revision };
          } catch (error: any) {
            if (error.status !== 409) throw error;
            plan = await this.deps.load(week);
            if (!plan) throw new Error("Could not load the newer cloud plan.");
          }
        }
      }
      if (this.edits !== edit || this.pending) return;
      this.revision = plan?.revision ?? null;
      this.hydrated = true;
      this.cloudLoadRequested = false;
      this.savedEdits = this.edits;
      this.publish({ week, items: plan?.items ?? [], ready: true,
        phase: plan ? "saved" : "empty", error: "" });
      // Do not re-import an old browser plan after a later week is cleared.
      if (initial && plan) this.clearLegacy();
    } catch {
      if (this.edits === edit && !this.pending) this.publish({ phase: "error",
        error: initial ? "Could not load your cloud plan. Retry before editing."
          : "Could not check for changes from your other devices." });
    } finally { this.refreshing = false; }
  }

  change(items: PlanItem[]): void {
    if (!this.snapshot.ready || this.snapshot.phase === "conflict") return;
    this.edits++;
    this.publish({ items });
    void this.save().catch(() => {}); // failure remains visible in the snapshot
  }

  retry(): Promise<void> {
    return this.cloudLoadRequested || !this.snapshot.ready || !this.unsaved ? this.refresh() : this.save();
  }

  save(): Promise<void> {
    if (!this.snapshot.ready) return Promise.reject(new Error("Load the cloud plan before saving."));
    if (this.snapshot.phase === "conflict") return Promise.reject(new Error(this.snapshot.error));
    if (this.pending) return this.pending;
    this.pending = this.flush().finally(() => { this.pending = null; });
    return this.pending;
  }

  private async flush(): Promise<void> {
    while (this.savedEdits !== this.edits) {
      const edit = this.edits, items = this.snapshot.items, week = this.snapshot.week;
      this.publish({ phase: "saving", error: "" });
      try {
        const result = await this.deps.save({ week_start: week, expected_revision: this.revision,
          status: "saved", items });
        this.revision = result.revision;
        this.savedEdits = edit;
        this.clearLegacy();
      } catch (error: any) {
        this.publish({ phase: error.status === 409 ? "conflict" : "error",
          error: error.status === 409
            ? "A newer plan was saved on another device. Your edits here are unsaved. Load the cloud plan to continue."
            : "Could not save your plan. Keep this tab open and retry." });
        throw error;
      }
    }
    this.publish({ phase: this.revision === null ? "empty" : "saved", error: "" });
  }
}
