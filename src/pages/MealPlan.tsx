import React, { useMemo, useState } from "react";
import { useStore } from "../store.tsx";
import { api } from "../lib/api.ts";
import RecipeModal from "../components/RecipeModal.tsx";
import type { Slot, Recipe } from "../engine/types.ts";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PROTEINS = ["chicken", "beef", "pork", "fish", "none"];

export default function MealPlan() {
  const s = useStore();
  const [search, setSearch] = useState("");
  const [protein, setProtein] = useState("");
  const [flyerMsg, setFlyerMsg] = useState("");
  const [open, setOpen] = useState<Recipe | null>(null);
  const byId = useMemo(() => new Map(s.recipes.map((r) => [r.id, r])), [s.recipes]);

  if (s.loading) return <p>Loading recipes…</p>;

  const cell = (day: number, slot: Slot) =>
    s.plan.find((p) => p.day_of_week === day && p.slot === slot);

  const onDrop = (day: number, slot: Slot, e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("recipe");
    if (id) s.assignSlot(day, slot, id);
  };

  const filtered = s.recipes.filter((r) => {
    if (s.states[r.id]?.is_hidden) return false;
    if (protein && r.primary_protein !== protein) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).slice(0, 80);

  const onFlyer = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setFlyerMsg("Reading flyer…");
    const images = await Promise.all(files.map(async (f) => ({
      mime: f.type || "application/pdf",
      data: btoa(new Uint8Array(await f.arrayBuffer()).reduce((a, b) => a + String.fromCharCode(b), "")),
    })));
    try {
      const res = await api.parseFlyer(images);
      if (res.deals) { s.setDeals(res.deals);
        setFlyerMsg(`${res.store}: ${Object.keys(res.deals).length} good-value deals added. Regenerate to use them.`); }
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
              <input type="file" accept="image/*,application/pdf" multiple hidden onChange={onFlyer} />
            </label>
            <button className="btn" onClick={s.generate}>Generate plan</button>
            <button className="btn dark" onClick={s.savePlan}>Save</button>
          </div>
        </div>
        {flyerMsg && <div className="banner">{flyerMsg}</div>}
        {Object.keys(s.deals).length > 0 &&
          <div className="banner ok">Using {Object.keys(s.deals).length} flyer deals + seasonality.</div>}
        {!s.plan.length && <p className="muted">No plan yet — hit “Generate plan”, or drag recipes
          from the right into any slot. Optimises for cost, Portugal seasonality, ease, your pantry, and favourites.</p>}

        {s.plan.length > 0 && DAYS.map((d, i) => {
          const day = i + 1;
          return (
            <div className="day" key={day}>
              <div className="day-label">{d}</div>
              <div className="slots">
                {(["lunch", "dinner"] as Slot[]).map((slot) => {
                  const it = cell(day, slot);
                  const r = it?.recipe_id ? byId.get(it.recipe_id) : null;
                  return (
                    <div key={slot}
                      className={"slot" + (it?.is_leftover ? " leftover" : "")}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => onDrop(day, slot, e)}>
                      <div className="slot-head">
                        <span className="slot-type">{slot}</span>
                        {r && <span className="slot-actions">
                          <button title="favourite" className={s.states[r.id]?.is_favorite ? "icon on" : "icon"}
                            onClick={() => s.signal(r.id, s.states[r.id]?.is_favorite ? "unfavorite" : "favorite")}>★</button>
                          <button title="remove" className="icon"
                            onClick={() => s.clearSlot(day, slot)}>✕</button>
                        </span>}
                      </div>
                      {r ? <>
                        <div className="recipe-name link" onClick={() => setOpen(r)}>{r.name}</div>
                        <div className="meta">{it?.is_leftover ? "leftovers" : `${r.total_time} min`}
                          {r.cuisine ? ` · ${r.cuisine}` : ""}</div>
                      </> : <div className="muted drop-hint">drop a recipe here</div>}
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
        <input placeholder="Search recipes…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="chips">
          {PROTEINS.map((p) => (
            <button key={p} className={protein === p ? "chip on" : "chip"}
              onClick={() => setProtein(protein === p ? "" : p)}>{p === "none" ? "veg" : p}</button>
          ))}
        </div>
        <p className="muted small">Drag a recipe onto a slot, or tap its name to view / remix.</p>
        <div className="rail-list">
          {filtered.map((r) => {
            const fav = s.states[r.id]?.is_favorite;
            return (
              <div className="rail-item" key={r.id} draggable
                onDragStart={(e) => e.dataTransfer.setData("recipe", r.id)}>
                <div className="ri-main">
                  <div className="recipe-name link" onClick={() => setOpen(r)}>{r.name}</div>
                  <div className="meta">{r.total_time}m · {r.primary_protein}{r.cuisine ? ` · ${r.cuisine}` : ""}</div>
                </div>
                <div className="ri-actions">
                  <button title="favourite" className={fav ? "icon on" : "icon"}
                    onClick={() => s.signal(r.id, fav ? "unfavorite" : "favorite")}>★</button>
                  <button title="hide" className="icon" onClick={() => s.signal(r.id, "hide")}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {open && <RecipeModal recipe={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
