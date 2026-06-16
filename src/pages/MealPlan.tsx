import React, { useMemo, useState } from "react";
import { useStore } from "../store.tsx";
import { api } from "../lib/api.ts";
import RecipeModal from "../components/RecipeModal.tsx";
import type { Slot, Recipe } from "../engine/types.ts";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PROTEINS = ["chicken", "beef", "pork", "fish", "none"];

type DealPick = { name: string; unit: string | null; price: number | null;
  normal_price: number | null; discount: number | null; saving: number | null; recipes?: number };
type StoreDeal = DealPick & { store: string };
type BestStore = { store: string; reason: string; deal_count: number };
type Analysis = { theme: string | null; top_pick: DealPick | null; for_you: DealPick[];
  stock_up: DealPick[]; cook_fresh: DealPick[] };

const eur = (n: number | null) => (n == null ? "" : "€" + n.toFixed(2));
const pct = (d: number | null) => (d ? `-${Math.round(d * 100)}%` : "");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtDay = (iso: string) => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MON[m - 1]}`; };
const fmtRange = (from: string | null, to: string | null) =>
  from && to ? `${fmtDay(from)} – ${fmtDay(to)}` : from ? `from ${fmtDay(from)}` : to ? `until ${fmtDay(to)}` : "";

// Cross-store overview: leads with the single best shop this week (scored on its
// discounted, recipe-relevant, diet-friendly deals — ignoring sugar/alcohol/non-
// food), then the strongest individual deals across all shops.
function BestDeals({ deals, best, dates, onCook, cookingStore }:
  { deals: StoreDeal[]; best: BestStore | null; dates: { from: string | null; to: string | null } | null;
    onCook: (store: string) => void; cookingStore: string | null }) {
  if (!deals.length && !best) return null;
  const range = dates ? fmtRange(dates.from, dates.to) : "";
  return (
    <div className="best-deals">
      {range && <div className="bd-dates">📅 Deals valid {range}</div>}
      {best && (
        <div className="bd-best">
          <div className="bd-best-head">🏆 Best shop this week: <b>{best.store}</b></div>
          <div className="bd-best-why">{best.reason}.</div>
          <button className="btn small dark bd-cook" disabled={!!cookingStore}
            onClick={() => onCook(best.store)}>
            {cookingStore === best.store ? "Cooking up a menu…" : `🍳 Cook a menu from ${best.store}'s deals`}</button>
        </div>
      )}
      {deals.length > 0 && <>
        <div className="bd-head">Top deals across your shops</div>
        {deals.map((d, i) => (
          <div className="bd-row" key={i}>
            <span className="bd-store">{d.store}</span>
            <span className="bd-name">{d.name}</span>
            <span className="bd-meta">
              {eur(d.price)} {d.discount ? <b className="fa-disc">{pct(d.discount)}</b> : null}
              {d.recipes ? <span className="fa-rec"> · in {d.recipes} recipes</span> : null}
            </span>
          </div>
        ))}
      </>}
    </div>
  );
}

type GenRecipe = {
  name: string; description?: string; cuisine?: string; primary_protein?: string;
  total_time?: number; servings?: number; deal_used?: string[];
  ingredients?: { name: string; quantity: number | null; unit: string; category: string }[];
  instructions?: string[];
};

// Generated "cook from the deals" menu: full recipes built around a shop's sale
// items. Read them here and save into the recipe DB to plan/remix like any recipe.
function DealMenu({ data, onClose, onSaved }:
  { data: { store: string; recipes: GenRecipe[] }; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const saveAll = async () => {
    setSaving(true);
    for (const r of data.recipes) { try { await api.createRecipe(r); } catch { /* skip */ } }
    setSaving(false); setSaved(true); onSaved();
  };
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal deal-menu" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}>✕</button>
        <h2>Cook from {data.store}'s deals</h2>
        <p className="muted small" style={{ marginTop: 2 }}>
          {data.recipes.length} dinners generated around what's on sale this week.</p>
        {data.recipes.map((r, i) => (
          <div className="dm-recipe" key={i}>
            <div className="dm-title">{i + 1}. {r.name}
              {r.total_time ? <span className="muted small"> · {r.total_time} min</span> : null}</div>
            {r.description && <div className="muted small">{r.description}</div>}
            {r.deal_used && r.deal_used.length > 0 &&
              <div className="dm-deals">🏷️ on sale: {r.deal_used.join(", ")}</div>}
            <details>
              <summary className="dm-sum">Ingredients & method</summary>
              <ul className="dm-ings">
                {(r.ingredients || []).map((it, k) => (
                  <li key={k}>{it.quantity ? `${it.quantity} ` : ""}{it.unit ? `${it.unit} ` : ""}{it.name}</li>
                ))}
              </ul>
              <ol className="dm-steps">
                {(r.instructions || []).map((s, k) => <li key={k}>{s}</li>)}
              </ol>
            </details>
          </div>
        ))}
        <div className="dm-actions">
          <button className="btn" disabled={saving || saved} onClick={saveAll}>
            {saved ? "Saved to your recipes ✓" : saving ? "Saving…" : "Save all to my recipes"}</button>
          {saved && <span className="muted small">Now plannable and searchable like any recipe.</span>}
        </div>
      </div>
    </div>
  );
}

// Compact, personalised deal breakdown inside each flyer card. Leads with the
// single best pick (cheapest food you're likely to eat), then supporting lenses.
function FlyerAnalysis({ a }: { a: Analysis }) {
  const Row = ({ d, showRecipes }: { d: DealPick; showRecipes?: boolean }) => (
    <div className="fa-item">
      <span className="fa-name">{d.name}</span>
      <span className="fa-meta">
        {eur(d.price)} {d.discount ? <b className="fa-disc">{pct(d.discount)}</b> : null}
        {showRecipes && d.recipes ? <span className="fa-rec"> · in {d.recipes} recipes</span> : null}
      </span>
    </div>
  );
  const Group = ({ label, items, showRecipes }:
    { label: string; items: DealPick[]; showRecipes?: boolean }) =>
    items.length ? (
      <div className="fa-group">
        <div className="fa-label">{label}</div>
        {items.slice(0, 3).map((d, i) => <Row key={i} d={d} showRecipes={showRecipes} />)}
      </div>
    ) : null;
  return (
    <div className="flyer-analysis">
      <Group label="Stock up" items={a.stock_up} />
      <Group label="Cook fresh now" items={a.cook_fresh} />
    </div>
  );
}

export default function MealPlan() {
  const s = useStore();
  const [search, setSearch] = useState("");
  const [protein, setProtein] = useState("");
  const [flyerMsg, setFlyerMsg] = useState("");
  const [open, setOpen] = useState<Recipe | null>(null);
  const [saveMsg, setSaveMsg] = useState("");
  const [flyers, setFlyers] = useState<any[]>([]);
  const [bestDeals, setBestDeals] = useState<StoreDeal[]>([]);
  const [bestStore, setBestStore] = useState<BestStore | null>(null);
  const [bestDates, setBestDates] = useState<{ from: string | null; to: string | null } | null>(null);
  const [expandedFlyers, setExpandedFlyers] = useState<Set<number>>(new Set());
  const toggleFlyer = (id: number) => setExpandedFlyers((p) => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const [dealMenu, setDealMenu] = useState<{ store: string; recipes: GenRecipe[] } | null>(null);
  const [cookingStore, setCookingStore] = useState<string | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discovered, setDiscovered] = useState<any[]>([]);
  const [fetchingUrls, setFetchingUrls] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; stores: number } | null>(null);
  const [loadedUrls, setLoadedUrls] = useState<Set<string>>(new Set());
  const [compare, setCompare] = useState<any>(null);
  const [comparing, setComparing] = useState(false);
  const [activeSlot, setActiveSlot] = useState<{ day: number; slot: Slot } | null>(null);
  const [editInstr, setEditInstr] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editMsg, setEditMsg] = useState("");
  const byId = useMemo(() => new Map(s.recipes.map((r) => [r.id, r])), [s.recipes]);

  // Flyers and the cross-store best-deals overview move together — reload both.
  const reloadFlyers = React.useCallback(async () => {
    await Promise.all([
      api.flyers().then(setFlyers).catch(() => {}),
      api.bestDeals().then((r) => { setBestDeals(r.deals || []); setBestStore(r.best || null); setBestDates(r.dates || null); }).catch(() => {}),
    ]);
  }, []);
  React.useEffect(() => { reloadFlyers(); }, [reloadFlyers]);
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

  const doSave = async () => {
    setSaveMsg("Saving…");
    try { await s.savePlan(); setSaveMsg("Plan saved ✓ — shopping list is on the Shop tab."); }
    catch { setSaveMsg("Save failed."); }
    setTimeout(() => setSaveMsg(""), 4000);
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

  // One trigger: discover the selected stores' current flyers, then fetch+parse
  // every one automatically. No per-flyer clicking — the user waits, doesn't click.
  const autoLoad = async () => {
    if (discovering || loading) return;
    const ids = selectedStoreIds.length ? selectedStoreIds : allStoreIds;
    if (!ids.length) { setFlyerMsg("Pick at least one store first."); return; }
    setFlyerMsg("Finding this week's flyers…");
    setDiscovering(true); setDiscovered([]); setLoadedUrls(new Set()); setProgress(null);
    let stores: any[] = [];
    try { stores = (await api.discoverFlyers(ids)).stores || []; }
    catch { setFlyerMsg("Flyer discovery failed (Firecrawl key set?)."); setDiscovering(false); return; }
    setDiscovered(stores);
    setDiscovering(false);

    const jobs = stores.flatMap((st: any) =>
      (st.flyers || []).map((f: any) => ({ store_id: st.store_id, store_name: st.store_name, kind: st.kind, url: f.url, title: f.title })));
    if (!jobs.length) { setFlyerMsg("No current grocery flyers found for the selected stores."); return; }

    const merged: Record<string, number> = { ...s.deals };
    let loaded = 0, totalItems = 0, done = 0;
    const fails: string[] = [];
    const storeCount = new Set(jobs.map((j) => j.store_id)).size;
    setLoading(true);
    setProgress({ done: 0, total: jobs.length, stores: storeCount });
    setFlyerMsg(`Loading ${jobs.length} flyers from ${storeCount} store${storeCount > 1 ? "s" : ""}…`);

    // Image-OCR flyers are parsed ONE PAGE PER REQUEST: a single Worker call that
    // base64s + OCRs a whole 10-page flyer blows the free-plan CPU limit, so we
    // list the pages (cheap), OCR each page in its own request (each stays under
    // the limit), then save the merged items. Flyers run serially and pages run
    // serially within them — concurrent heavy requests share one Pages isolate's
    // CPU and trip "Worker exceeded CPU time limit". Slower but reliable.
    const ocrFlyer = async (jb: any) => {
      const pg = await api.flyerPages({ store_id: jb.store_id, flyer_url: jb.url });
      if (pg.error || !(pg.pages || []).length) { fails.push(`${jb.store_name}: ${pg.error || "no pages found"}`); return; }
      const seen = new Set<string>();
      const items: any[] = [];
      let vfrom = pg.from || null, vto = pg.to || null, summary: string | null = null;
      for (let i = 0; i < pg.pages.length; i++) {
        setFlyerMsg(`${jb.store_name}: reading page ${i + 1}/${pg.pages.length}…`);
        let r: any;
        try { r = await api.ocrPage({ image_url: pg.pages[i] }); } catch { continue; }
        if (!r || r.error || !Array.isArray(r.items)) continue;
        vfrom = vfrom || r.valid_from; vto = vto || r.valid_to; summary = summary || r.summary;
        for (const it of r.items) {
          if (!it?.name || typeof it.price !== "number") continue;
          const k = `${it.name.toLowerCase()}|${it.price}`;
          if (seen.has(k)) continue;
          seen.add(k); items.push(it);
        }
      }
      if (!items.length) { fails.push(`${jb.store_name}: no grocery deals found`); return; }
      const saved = await api.saveFlyer({ store_id: jb.store_id, store_name: jb.store_name, valid_from: vfrom, valid_to: vto, summary, items, page_count: pg.pages.length });
      if (saved.error) { fails.push(`${jb.store_name}: ${saved.error}`); return; }
      loaded++; totalItems += saved.item_count || 0; Object.assign(merged, saved.deals || {});
      setLoadedUrls((prev) => new Set(prev).add(jb.url));
    };

    for (const jb of jobs) {
      setFetchingUrls((prev) => new Set(prev).add(jb.url));
      try {
        if (jb.kind === "ipaper-image" || jb.kind === "leaflet") {
          await ocrFlyer(jb);
        } else {
          // Structured iPaper feed / generic upload: one cheap call, no OCR loop.
          const res = await api.fetchFlyer({ store_id: jb.store_id, store_name: jb.store_name, flyer_url: jb.url });
          if (res.error) fails.push(`${jb.store_name}: ${res.error}`);
          else {
            loaded++; totalItems += res.item_count || 0; Object.assign(merged, res.deals || {});
            setLoadedUrls((prev) => new Set(prev).add(jb.url));
          }
        }
      } catch { fails.push(`${jb.store_name}: timed out or failed.`); }
      setFetchingUrls((prev) => { const n = new Set(prev); n.delete(jb.url); return n; });
      done++;
      setProgress({ done, total: jobs.length, stores: storeCount });
    }

    if (Object.keys(merged).length) s.setDeals(merged);
    await reloadFlyers();
    const tail = fails.length ? ` · couldn't load: ${fails.join("; ")}` : "";
    setFlyerMsg(`Loaded ${loaded}/${jobs.length} flyers · ${totalItems} grocery prices.${tail}`);
    setLoading(false);
    setProgress(null);
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
        reloadFlyers(); }
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
            <button className="btn dark" onClick={doSave}>Save</button>
          </div>
        </div>
        {flyerMsg && <div className="banner">{flyerMsg}</div>}

        {discoverOpen && (
          <div className="discover-panel">
            <div className="discover-head">
              <span>Fetch new flyers — choose stores, then load (no clicking per flyer):</span>
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
              <button className="btn small dark" disabled={discovering || loading} onClick={autoLoad}>
                {discovering || loading ? "Loading…" : "Load this week's flyers"}</button>
            </div>
            {(discovering || progress) && (
              <div className="fetch-prog">
                <div className="muted small">
                  {discovering ? "Searching store sites…"
                    : `Loading flyers… ${progress!.done}/${progress!.total}` +
                      (progress!.total > progress!.stores
                        ? ` · ${progress!.total} flyers across ${progress!.stores} stores (incl. next week)`
                        : ` · ${progress!.stores} store${progress!.stores > 1 ? "s" : ""}`)}
                </div>
                <div className="prog">
                  {progress
                    ? <div className="prog-bar" style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }} />
                    : <div className="prog-bar indet" />}
                </div>
              </div>
            )}
            {!discovering && discovered.map((st) => (
              <div className="discover-store" key={st.store_id}>
                <div className="ds-name">{st.store_name}
                  {st.kind !== "ipaper" && <span className="muted small"> · manual</span>}</div>
                {st.flyers?.length > 0 ? (
                  <div className="ds-flyers">
                    {st.flyers.map((f: any) => (
                      <span className="flyer-chip" key={f.url}>
                        {fetchingUrls.has(f.url) ? "⏳ " : loadedUrls.has(f.url) ? "✓ " : "• "}{f.title}
                      </span>
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

            <BestDeals deals={bestDeals} best={bestStore} dates={bestDates} cookingStore={cookingStore}
              onCook={async (store) => {
                setCookingStore(store);
                try {
                  const d = await api.dealPlan(store, s.settings.plan_days);
                  if (d.recipes?.length) setDealMenu(d);
                  else setFlyerMsg(d.error || "Couldn't generate a menu from these deals.");
                } catch { setFlyerMsg("Menu generation failed."); }
                setCookingStore(null);
              }} />

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
                const hasBody = !!(f.analysis || f.summary);
                const open = expandedFlyers.has(f.id);
                return (
                <div className={"flyer-card" + (status === "expired" ? " expired" : "")
                  + (status === "upcoming" ? " upcoming" : "")} key={f.id}>
                  <div className={"flyer-head" + (hasBody ? " clickable" : "")}
                    onClick={hasBody ? () => toggleFlyer(f.id) : undefined}>
                    <div>
                      <div className="flyer-store">{f.store_name}
                        {status === "expired" && <span className="flyer-exp"> · expired</span>}
                        {status === "upcoming" && <span className="flyer-soon"> · starts {f.valid_from}</span>}</div>
                      <div className="flyer-dates">
                        {f.valid_from || "?"} → {f.valid_to || "?"} · {f.item_count} items</div>
                    </div>
                    {hasBody && <span className="flyer-caret">{open ? "▾" : "▸"}</span>}
                  </div>
                  {open && f.analysis?.theme && <div className="fa-theme">{f.analysis.theme}</div>}
                  {open && f.summary && <div className="flyer-sum">{f.summary}</div>}
                  {open && (f.analysis
                    ? <FlyerAnalysis a={f.analysis} />
                    : status === "active" &&
                      <div className="flyer-track muted small">Prices tracked · no current discounts</div>)}
                  <div className="flyer-actions">
                    <button className="btn small" onClick={() => {
                      s.setDeals(f.deals); s.generate();
                      setFlyerMsg(`Plan generated favouring ${f.store_name} deals.`);
                    }}>Plan from this</button>
                    <button className="icon" title="remove"
                      onClick={() => api.delFlyer(f.id).then(reloadFlyers)}>🗑</button>
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

        {s.plan.length > 0 && (
          <div className="plan-save-row">
            <button className="btn dark" onClick={doSave}>Save plan & build shopping list</button>
            {saveMsg && <span className="muted small">{saveMsg}</span>}
          </div>
        )}
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
      {dealMenu && <DealMenu data={dealMenu} onClose={() => setDealMenu(null)}
        onSaved={() => s.refreshRecipes()} />}
    </div>
  );
}
