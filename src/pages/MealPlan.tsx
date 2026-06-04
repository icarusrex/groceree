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
  const [saveMsg, setSaveMsg] = useState("");
  const [flyers, setFlyers] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<any[]>([]);
  const [fetchingUrl, setFetchingUrl] = useState("");
  const [compare, setCompare] = useState<any>(null);
  const [comparing, setComparing] = useState(false);
  const [activeSlot, setActiveSlot] = useState<{ day: number; slot: Slot } | null>(null);
  const [editInstr, setEditInstr] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editMsg, setEditMsg] = useState("");
  const byId = useMemo(() => new Map(s.recipes.map((r) => [r.id, r])), [s.recipes]);

  React.useEffect(() => { api.flyers().then(setFlyers).catch(() => {}); }, []);
  React.useEffect(() => { api.flyerSources().then((r) => setSources(r.sources || [])).catch(() => {}); }, []);

  if (s.loading) return <p>Loading recipes…</p>;

  // store selection: settings.selected_stores is [] when "all"; resolve to the
  // full id list for the checkboxes, and normalise back to [] when all are on.
  const allStoreIds = sources.map((x) => x.store_id);
  const selectedStoreIds = s.settings.selected_stores.length ? s.settings.selected_stores : allStoreIds;
  const storeChecked = (id: string) => selectedStoreIds.includes(id);
  const toggleStore = (id: string) => {
    const next = storeChecked(id)
      ? selectedStoreIds.filter((x: string) => x !== id)
      : [...selectedStoreIds, id];
    const norm = next.length === allStoreIds.length ? [] : next;
    s.setSettings({ ...s.settings, selected_stores: norm });
  };

  const cell = (day: number, slot: Slot) =>
    s.plan.find((p) => p.day_of_week === day && p.slot === slot);

  const onDrop = (day: number, slot: Slot, e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("recipe");
    if (id) s.assignSlot(day, slot, id);
    setActiveSlot(null);
  };

  // tablet-friendly: tap a slot to target it, then tap a recipe to place it
  const toggleSlot = (day: number, slot: Slot) =>
    setActiveSlot((cur) => (cur && cur.day === day && cur.slot === slot ? null : { day, slot }));

  const pickRecipe = (r: Recipe) => {
    if (activeSlot) { s.assignSlot(activeSlot.day, activeSlot.slot, r.id); setActiveSlot(null); }
    else setOpen(r);
  };

  const runEdit = async () => {
    if (!editInstr.trim()) return;
    setEditBusy(true); setEditMsg("Editing your week…");
    const planNamed = s.plan.map((p) => ({
      day_of_week: p.day_of_week, slot: p.slot, is_leftover: p.is_leftover,
      recipe_id: p.recipe_id, recipe_name: p.recipe_id ? byId.get(p.recipe_id)?.name : null,
    }));
    try {
      const res = await api.editPlan(planNamed, editInstr.trim());
      if (res.error) setEditMsg(res.error);
      else if (!res.changes?.length) setEditMsg("No changes suggested — try rephrasing.");
      else { s.applyPlanChanges(res.changes); setEditMsg(`Updated ${res.changes.length} meal${res.changes.length > 1 ? "s" : ""}. Save to keep it.`); setEditInstr(""); }
    } catch { setEditMsg("Edit failed (Gemini key set?)."); }
    setEditBusy(false);
  };

  const filtered = s.recipes.filter((r) => {
    if (s.states[r.id]?.is_hidden) return false;
    if (protein && r.primary_protein !== protein) return false;
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const today = new Date().toISOString().slice(0, 10);
  const liveFlyers = flyers.filter((f) => !(f.valid_to && f.valid_to < today));
  const storeCount = new Set(liveFlyers.map((f) => f.store_name)).size;

  const runCompare = async () => {
    setComparing(true); setCompare(null);
    const planned = s.plan
      .filter((p) => p.recipe_id)
      .map((p) => byId.get(p.recipe_id!))
      .filter(Boolean)
      .map((r: any) => ({ name: r.name, cuisine: r.cuisine, primary_protein: r.primary_protein }));
    try {
      const res = await api.compareStores(planned);
      setCompare(res);
    } catch { setCompare({ error: "Comparison failed (Gemini key set?)." }); }
    setComparing(false);
  };

  const runDiscover = async () => {
    if (discovering) return;
    const ids = selectedStoreIds.length ? selectedStoreIds : allStoreIds;
    if (!ids.length) { setFlyerMsg("Pick at least one store first."); return; }
    setFlyerMsg("");
    setDiscovering(true); setDiscovered([]);
    try { setDiscovered((await api.discoverFlyers(ids)).stores || []); }
    catch { setFlyerMsg("Flyer discovery failed (Firecrawl key set?)."); }
    setDiscovering(false);
  };

  const fetchOnline = async (storeId: string, storeName: string, url: string) => {
    setFetchingUrl(url); setFlyerMsg(`Fetching ${storeName} flyer…`);
    try {
      const res = await api.fetchFlyer({ store_id: storeId, store_name: storeName, flyer_url: url });
      if (res.error) setFlyerMsg(res.error);
      else {
        if (res.deals && Object.keys(res.deals).length) s.setDeals(res.deals);
        setFlyerMsg(`${res.store}: loaded ${res.item_count} grocery prices. ${res.summary || ""}`);
        api.flyers().then(setFlyers);
      }
    } catch { setFlyerMsg("Fetch failed."); }
    setFetchingUrl("");
  };

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
        setFlyerMsg(`${res.store}: ${Object.keys(res.deals).length} good-value deals added.${res.summary ? " " + res.summary : ""}`);
        api.flyers().then(setFlyers); }
      else setFlyerMsg(res.error || "Could not parse flyer.");
    } catch { setFlyerMsg("Flyer parsing failed."); }
  };

  return (
    <div className="plan-wrap">
      <div className="plan-main">
        <div className="header-row">
          <h1>Meal Planner</h1>
          <div className="actions">
            <button className="btn ghost" onClick={() => setDiscoverOpen(true)}>Fetch new flyers</button>
            <label className="btn ghost">Upload flyer
              <input type="file" accept="image/*,application/pdf" multiple hidden onChange={onFlyer} />
            </label>
            <div className="seg" title="How many days to plan">
              {[4, 7].map((d) => (
                <button key={d} className={s.settings.plan_days === d ? "seg-btn on" : "seg-btn"}
                  onClick={() => s.setSettings({ ...s.settings, plan_days: d })}>{d} days</button>
              ))}
            </div>
            <button className="btn" onClick={() => s.generate()}>Generate plan</button>
            <button className="btn dark" onClick={async () => {
              setSaveMsg("Saving…");
              try { await s.savePlan(); setSaveMsg("Plan saved ✓ — shopping list is on the Shop tab."); }
              catch { setSaveMsg("Save failed."); }
              setTimeout(() => setSaveMsg(""), 4000);
            }}>Save</button>
          </div>
        </div>
        {flyerMsg && <div className="banner">{flyerMsg}</div>}

        {discoverOpen && (
          <div className="discover-panel">
            <div className="discover-head">
              <span>Fetch new flyers — choose stores, then search:</span>
              <button className="icon" title="close" onClick={() => setDiscoverOpen(false)}>✕</button>
            </div>
            <div className="store-picker">
              {sources.map((st) => (
                <label key={st.store_id} className="store-check">
                  <input type="checkbox" checked={storeChecked(st.store_id)}
                    onChange={() => toggleStore(st.store_id)} />
                  {st.store_name}
                  {st.kind !== "ipaper" && <span className="muted small"> · manual</span>}
                </label>
              ))}
              <button className="btn small dark" disabled={discovering} onClick={runDiscover}>
                {discovering ? "Searching…" : "Search selected"}</button>
            </div>
            {discovering && <div className="muted small">Searching store sites…</div>}
            {!discovering && discovered.length > 0 &&
              <div className="muted small" style={{ marginTop: 6 }}>Pick a flyer to load its prices:</div>}
            {!discovering && discovered.map((st) => (
              <div className="discover-store" key={st.store_id}>
                <div className="ds-name">{st.store_name}
                  {st.kind !== "ipaper" && <span className="muted small"> · manual</span>}</div>
                {st.flyers?.length > 0 ? (
                  <div className="ds-flyers">
                    {st.flyers.map((f: any) => (
                      <button className="btn small" key={f.url} disabled={!!fetchingUrl}
                        onClick={() => fetchOnline(st.store_id, st.store_name, f.url)}>
                        {fetchingUrl === f.url ? "Loading…" : `↓ ${f.title}`}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="muted small">{st.note || "No flyers found."}
                    {st.landing && <> · <a href={st.landing} target="_blank" rel="noreferrer">open store page</a></>}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {saveMsg && <div className="banner ok">{saveMsg}</div>}
        {Object.keys(s.deals).length > 0 &&
          <div className="banner ok">Using {Object.keys(s.deals).length} flyer deals + seasonality.</div>}

        {flyers.length > 0 && (
          <div className="flyers-strip">
            <div className="flyers-head">
              <span>Your flyers — generate a plan favouring one store's deals:</span>
              {storeCount >= 2 && (
                <button className="btn small" disabled={comparing} onClick={runCompare}>
                  {comparing ? "Comparing…" : "🛒 Which store this week?"}</button>
              )}
            </div>

            {compare && !compare.error && !compare.insufficient && (
              <div className="compare-card">
                <div className="compare-top">
                  <span className="compare-winner">🏆 {compare.winner}</span>
                  {compare.theme && <span className="compare-theme">{compare.theme}</span>}
                  {(() => {
                    const wf = flyers.find((f) => f.store_name === compare.winner);
                    return wf ? (
                      <button className="btn small dark" onClick={() => {
                        s.setDeals(wf.deals); s.generate();
                        setFlyerMsg(`Plan generated favouring ${wf.store_name} deals.`);
                      }}>Plan from {compare.winner}</button>
                    ) : null;
                  })()}
                </div>
                <p className="compare-reason">{compare.reason}</p>
                <div className="compare-stores">
                  {(compare.stores || []).map((st: any, k: number) => (
                    <div className="compare-store" key={k}>
                      <div className="cs-name">{st.store}{st.store === compare.winner ? " ✓" : ""}</div>
                      {st.verdict && <div className="muted small">{st.verdict}</div>}
                      {(st.best_for || []).length > 0 &&
                        <div className="cs-chips">{st.best_for.map((b: string, i: number) =>
                          <span className="cs-chip" key={i}>{b}</span>)}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {compare?.insufficient && <div className="banner">{compare.message}</div>}
            {compare?.error && <div className="banner">{compare.error}</div>}

            <div className="flyer-cards">
              {flyers.map((f) => {
                const today = new Date().toISOString().slice(0, 10);
                const upcoming = f.valid_from && f.valid_from > today;
                const expired = f.valid_to && f.valid_to < today;
                const status = expired ? "expired" : upcoming ? "upcoming" : "active";
                return (
                <div className={"flyer-card" + (status === "expired" ? " expired" : "")
                  + (status === "upcoming" ? " upcoming" : "")} key={f.id}>
                  <div className="flyer-store">{f.store_name}
                    {status === "expired" && <span className="flyer-exp"> · expired</span>}
                    {status === "upcoming" && <span className="flyer-soon"> · starts {f.valid_from}</span>}</div>
                  <div className="flyer-dates">
                    {f.valid_from || "?"} → {f.valid_to || "?"} · {f.item_count} items</div>
                  {f.summary && <div className="flyer-sum">{f.summary}</div>}
                  <div className="flyer-actions">
                    <button className="btn small" onClick={() => {
                      s.setDeals(f.deals); s.generate();
                      setFlyerMsg(`Plan generated favouring ${f.store_name} deals.`);
                    }}>Plan from this</button>
                    <button className="icon" title="remove"
                      onClick={() => api.delFlyer(f.id).then(() => api.flyers().then(setFlyers))}>🗑</button>
                  </div>
                </div>
              );})}
            </div>
          </div>
        )}
        {s.plan.length > 0 && (
          <div className="ai-edit">
            <input placeholder='Edit the week with AI: "make Tuesday vegetarian", "cheaper week", "more fish"…'
              value={editInstr} onChange={(e) => setEditInstr(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") runEdit(); }} disabled={editBusy} />
            <button className="btn" disabled={editBusy} onClick={runEdit}>{editBusy ? "…" : "Edit with AI"}</button>
          </div>
        )}
        {editMsg && <div className="banner">{editMsg}</div>}

        {!s.plan.length && <p className="muted">No plan yet — hit “Generate plan”, or tap a slot then a recipe
          (drag works on desktop). Optimises for cost, Portugal seasonality, ease, your pantry, and favourites.</p>}

        {s.plan.length > 0 && DAYS.slice(0,
          Math.max(s.settings.plan_days, ...s.plan.map((p) => p.day_of_week))
        ).map((d, i) => {
          const day = i + 1;
          return (
            <div className="day" key={day}>
              <div className="day-label">{d}</div>
              <div className="slots">
                {(["lunch", "dinner"] as Slot[]).map((slot) => {
                  const it = cell(day, slot);
                  const r = it?.recipe_id ? byId.get(it.recipe_id) : null;
                  const isActive = activeSlot?.day === day && activeSlot?.slot === slot;
                  return (
                    <div key={slot}
                      className={"slot" + (it?.is_leftover ? " leftover" : "") + (isActive ? " active" : "")}
                      onClick={() => toggleSlot(day, slot)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => onDrop(day, slot, e)}>
                      <div className="slot-head">
                        <span className="slot-type">{slot}</span>
                        {r && <span className="slot-actions">
                          <button title="favourite" className={s.states[r.id]?.is_favorite ? "icon on" : "icon"}
                            onClick={(e) => { e.stopPropagation(); s.signal(r.id, s.states[r.id]?.is_favorite ? "unfavorite" : "favorite"); }}>★</button>
                          <button title="remove" className="icon"
                            onClick={(e) => { e.stopPropagation(); s.clearSlot(day, slot); setActiveSlot({ day, slot }); }}>✕</button>
                        </span>}
                      </div>
                      {r ? <>
                        <div className="recipe-name link"
                          onClick={(e) => { e.stopPropagation(); setOpen(r); }}>{r.name}</div>
                        <div className="meta">{it?.is_leftover ? "leftovers" : `${r.total_time} min`}</div>
                      </> : <div className="muted drop-hint">
                        {isActive ? "tap a recipe →" : "tap to select, or drop a recipe"}</div>}
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
        {activeSlot && (
          <div className="banner ok place-banner">
            Placing into <b>{DAYS[activeSlot.day - 1]} {activeSlot.slot}</b> — tap a recipe.
            <button className="btn small" onClick={() => setActiveSlot(null)}>Cancel</button>
          </div>
        )}
        <input placeholder="Search recipes…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="chips">
          {PROTEINS.map((p) => (
            <button key={p} className={protein === p ? "chip on" : "chip"}
              onClick={() => setProtein(protein === p ? "" : p)}>{p === "none" ? "veg" : p}</button>
          ))}
        </div>
        <p className="muted small">Tap a slot, then tap a recipe to place it. On desktop you can also
          drag. Tap a recipe name (with no slot selected) to view / remix.</p>
        <div className="rail-list">
          {filtered.map((r) => {
            const fav = s.states[r.id]?.is_favorite;
            return (
              <div className={"rail-item" + (activeSlot ? " placing" : "")} key={r.id} draggable
                onDragStart={(e) => e.dataTransfer.setData("recipe", r.id)}>
                <div className="ri-main" onClick={() => pickRecipe(r)}>
                  <div className="recipe-name link">{r.name}</div>
                  <div className="meta">{r.total_time}m · {r.primary_protein === "none" ? "veg" : r.primary_protein}</div>
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
