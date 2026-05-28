import React, { useMemo, useState } from "react";
import { useStore } from "../store.tsx";
import { api } from "../lib/api.ts";
import type { PlanItem, Slot } from "../engine/types.ts";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PROTEINS = ["chicken", "beef", "pork", "fish", "none"];

export default function MealPlan() {
  const s = useStore();
  const [sel, setSel] = useState<{ day: number; slot: Slot } | null>(null);
  const [search, setSearch] = useState("");
  const [protein, setProtein] = useState<string>("");
  const [flyerMsg, setFlyerMsg] = useState("");
  const byId = useMemo(() => new Map(s.recipes.map((r) => [r.id, r])), [s.recipes]);

  if (s.loading) return <p>Loading recipes…</p>;

  const cell = (day: number, slot: Slot): PlanItem | undefined =>
    s.plan.find((p) => p.day_of_week === day && p.slot === slot);

  const assign = (recipeId: string) => {
    if (!sel) return;
    const next = s.plan.filter((p) => !(p.day_of_week === sel.day && p.slot === sel.slot));
    next.push({ day_of_week: sel.day, slot: sel.slot, recipe_id: recipeId,
      is_leftover: false, leftover_of: null, servings: s.settings.household_size });
    localStorage.setItem("plan", JSON.stringify(next));
    location.reload(); // simple; store re-reads plan from localStorage
  };

  const filtered = s.recipes.filter((r) => {
    if (s.states[r.id]?.is_hidden) return false;
    if (protein && r.primary_protein !== protein) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).slice(0, 60);

  const onFlyer = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setFlyerMsg("Reading flyer…");
    const images = await Promise.all(files.map(async (f) => ({
      mime: f.type,
      data: btoa(String.fromCharCode(...new Uint8Array(await f.arrayBuffer()))),
    })));
    try {
      const res = await api.parseFlyer(images);
      if (res.deals) { s.setDeals(res.deals); setFlyerMsg(
        `${res.store}: ${Object.keys(res.deals).length} good-value deals added. Regenerate to use them.`); }
      else setFlyerMsg(res.error || "Could not parse flyer.");
    } catch { setFlyerMsg("Flyer parsing failed."); }
  };

  return (
    <div className="plan-wrap">
      <div className="plan-main">
        <div className="header-row">
          <h1>Meal Planner</h1>
          <div className="actions">
            <label className="btn ghost">From flyer
              <input type="file" accept="image/*" multiple hidden onChange={onFlyer} />
            </label>
            <button className="btn" onClick={s.generate}>Generate plan</button>
            <button className="btn dark" onClick={s.savePlan}>Save</button>
          </div>
        </div>
        {flyerMsg && <div className="banner">{flyerMsg}</div>}
        {Object.keys(s.deals).length > 0 &&
          <div className="banner ok">Using {Object.keys(s.deals).length} flyer deals + seasonality.</div>}
        {!s.plan.length && <p className="muted">No plan yet — hit “Generate plan”. It optimises for
          cost, seasonality (Portugal), ease, what’s in your pantry, and your favourites.</p>}

        {s.plan.length > 0 && DAYS.map((d, i) => {
          const day = i + 1;
          return (
            <div className="day" key={day}>
              <div className="day-label">{d}</div>
              <div className="slots">
                {(["lunch", "dinner"] as Slot[]).map((slot) => {
                  const it = cell(day, slot);
                  const r = it?.recipe_id ? byId.get(it.recipe_id) : null;
                  const active = sel?.day === day && sel?.slot === slot;
                  return (
                    <div key={slot}
                      className={"slot" + (active ? " active" : "") + (it?.is_leftover ? " leftover" : "")}
                      onClick={() => setSel({ day, slot })}>
                      <div className="slot-type">{slot}</div>
                      {r ? <>
                        <div className="recipe-name">{r.name}</div>
                        <div className="meta">
                          {it?.is_leftover ? "leftovers" : `${r.total_time} min`}
                          {r.cuisine ? ` · ${r.cuisine}` : ""}
                        </div>
                      </> : <div className="muted">click, then pick a recipe →</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <aside className="recipe-rail">
        <h3>Recipes</h3>
        <input placeholder="Search recipes…" value={search}
          onChange={(e) => setSearch(e.target.value)} />
        <div className="chips">
          {PROTEINS.map((p) => (
            <button key={p} className={protein === p ? "chip on" : "chip"}
              onClick={() => setProtein(protein === p ? "" : p)}>
              {p === "none" ? "veg" : p}</button>
          ))}
        </div>
        <p className="muted small">{sel ? `Assigning to ${DAYS[sel.day - 1]} ${sel.slot}` : "Tap a meal slot to assign"}</p>
        <div className="rail-list">
          {filtered.map((r) => {
            const fav = s.states[r.id]?.is_favorite;
            return (
              <div className="rail-item" key={r.id}>
                <div className="ri-main" onClick={() => assign(r.id)}>
                  <div className="recipe-name">{r.name}</div>
                  <div className="meta">{r.total_time}m · {r.primary_protein} · {r.cuisine}</div>
                </div>
                <div className="ri-actions">
                  <button title="favourite" className={fav ? "icon on" : "icon"}
                    onClick={() => s.signal(r.id, fav ? "unfavorite" : "favorite")}>★</button>
                  <button title="hide" className="icon"
                    onClick={() => s.signal(r.id, "hide")}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
