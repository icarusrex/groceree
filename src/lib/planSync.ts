import { todayInLisbon, weekOf, validDate } from "../engine/planDates.ts";
import type { PlanItem } from "../engine/types.ts";

export interface PlanMetadata { start_date: string; plan_days: number }
export interface CloudPlan extends PlanMetadata { items: PlanItem[]; revision: number; week_start: string }
export interface PlanWrite extends PlanMetadata {
  active: true;
  week_start: string;
  expected_revision: number | null;
  status: "saved";
  items: PlanItem[];
}
export interface PlanSnapshot extends PlanMetadata {
  week: string;
  items: PlanItem[];
  ready: boolean;
  phase: "loading" | "empty" | "saved" | "saving" | "error" | "conflict";
  error: string;
}
interface Dependencies {
  load: () => Promise<CloudPlan | null>;
  save: (plan: PlanWrite) => Promise<{ revision: number }>;
  week: () => string;
  readLegacy: () => PlanItem[] | Promise<PlanItem[]>;
  clearLegacy: () => void;
  changed: (snapshot: PlanSnapshot) => void;
}

// Portugal is the app's planning calendar, regardless of a device's timezone.
export function mondayOf(date = new Date()): string {
  return weekOf(todayInLisbon(date));
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
    // Old browser saves sometimes omitted links; recover next-day dinners.
    for(const item of value) {
      if(!item.is_leftover) {item.leftover_of=null;continue;}
      const source=item.leftover_of;
      let parent=source && value.find(p=>p.day_of_week===source.day_of_week && p.slot===source.slot && !p.is_leftover && p.recipe_id===item.recipe_id && p.recipe_id && p.day_of_week<item.day_of_week);
      if(!parent) parent=value.find(p=>p.day_of_week===item.day_of_week-1 && p.slot==='dinner' && !p.is_leftover && p.recipe_id===item.recipe_id && p.recipe_id);
      if(parent) item.leftover_of={day_of_week:parent.day_of_week,slot:parent.slot};
      else {item.is_leftover=false;item.leftover_of=null;}
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
    this.snapshot = { week: deps.week(), start_date: deps.week(), plan_days: 4, items: [], ready: false, phase: "loading", error: "" };
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
    // Explicit conflict recovery blocks edits while loading the saved plan.
    if (discardLocal)
      this.publish({ ready: false, phase: "loading", error: "" });
    try {
      let plan = await this.deps.load();
      if (initial && plan === null) {
        const legacy = await this.deps.readLegacy();
        if (legacy.length) {
          this.publish({ items: legacy, phase: "saving" });
          try {
            const metadata = { start_date: week, plan_days: legacy.some(p=>p.day_of_week>=5) ? 7 : 4 };
            const result = await this.deps.save({ active:true, ...metadata, week_start: week, expected_revision: null,
              status: "saved", items: legacy });
            plan = { ...metadata, week_start: week, items: legacy, revision: result.revision };
          } catch (error: any) {
            if (error.status !== 409) throw error;
            plan = await this.deps.load();
            if (!plan) throw new Error("Could not load the newer cloud plan.");
          }
        }
      }
      if (this.edits !== edit || this.pending) return;
      this.revision = plan?.revision ?? null;
      this.hydrated = true;
      this.cloudLoadRequested = false;
      this.savedEdits = this.edits;
      this.publish({ week: plan?.week_start ?? week, start_date: plan?.start_date ?? week,
        plan_days: plan?.plan_days ?? 4, items: plan?.items ?? [], ready: true,
        phase: plan ? "saved" : "empty", error: "" });
      // Do not re-import an old browser plan after a later week is cleared.
      if (initial && plan) this.clearLegacy();
    } catch {
      if (this.edits === edit && !this.pending) this.publish({ phase: "error",
        error: initial ? "Could not load your cloud plan. Retry before editing."
          : "Could not check for changes from your other devices." });
    } finally { this.refreshing = false; }
  }

  change(items: PlanItem[], metadata?: PlanMetadata): void {
    if (!this.snapshot.ready || this.snapshot.phase === "conflict") return;
    if(metadata && (!validDate(metadata.start_date) || ![4,7].includes(metadata.plan_days))) throw new Error('Invalid plan date range.');
    const week=metadata ? weekOf(metadata.start_date) : this.snapshot.week;
    this.edits++;
    this.publish({items,...(metadata ? {...metadata,week} : {})});
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
      const edit = this.edits, { items, week, start_date, plan_days } = this.snapshot;
      this.publish({ phase: "saving", error: "" });
      try {
        const result = await this.deps.save({ active:true, start_date, plan_days, week_start: week, expected_revision: this.revision,
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
