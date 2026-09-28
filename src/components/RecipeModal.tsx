import React, { useEffect, useRef, useState } from "react";
import { useStore } from "../store.tsx";
import { api } from "../lib/api.ts";
import type { Recipe } from "../engine/types.ts";
import { dietConflicts, recipeAllergens, type Allergen } from "../engine/allergens.ts";

// One-tap adaptations per allergen. Coconut aminos is the household's soy-sauce
// swap — tamari is gluten-free but still soy, so never suggest it.
const MAKE_FREE: Record<Allergen, { label: string; ask: string }> = {
  gluten: { label: "🌾 Make gluten-free", ask: "Make this gluten-free. Swap only what's necessary (gluten-free pasta/flour/bread, coconut aminos instead of soy sauce — not tamari, cornflour or arrowroot to thicken). Keep everything else the same and note if a swap changes the method." },
  dairy: { label: "🥛 Make dairy-free", ask: "Make this dairy-free with simple swaps (olive oil for butter, coconut milk/cream for cream, dairy-free yogurt), keeping it cookable. Lactose-free products still contain dairy — don't use them." },
  egg: { label: "🥚 Make egg-free", ask: "Make this egg-free: flax or chia 'eggs' or aquafaba to bind, egg-free/vegan mayo instead of mayonnaise, and drop egg-only toppings. Keep it cookable." },
  soy: { label: "🫘 Make soy-free", ask: "Make this soy-free: coconut aminos instead of soy sauce, tamari or teriyaki; no tofu, tempeh, miso or edamame; avoid sauces that contain soy." },
};

// pull "10 minutes" / "1 hour" durations out of a step → seconds
function stepTimer(text: string): number | null {
  const m = text.match(/(\d+)\s*(?:-\s*\d+\s*)?(hour|hr|minute|min)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return /h/i.test(m[2]) ? n * 3600 : n * 60;
}
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// "unit"/"un"/"whole" etc. aren't real units — "1 lemon", not "1 unit lemon".
const COUNT_WORDS = new Set(["unit", "units", "whole", "x", "un", "piece", "pieces", "each", "ea", "count"]);
const dispUnit = (u: string) => (COUNT_WORDS.has((u || "").toLowerCase().trim()) ? "" : u || "");

// Scaled quantities read like a recipe: whole grams, quarter-steps for small
// amounts ("1.5 tbsp", "0.25 tsp"), never "1.3333".
const fmtQty = (q: number) => {
  const r = q >= 10 ? Math.round(q) : Math.round(q * 4) / 4 || Math.round(q * 100) / 100;
  return String(r);
};

function Timer({ seconds, label }: { seconds: number; label: string }) {
  const [left, setLeft] = useState<number | null>(null);
  const ref = useRef<any>(null);
  useEffect(() => () => clearInterval(ref.current), []);
  const start = () => {
    setLeft(seconds);
    clearInterval(ref.current);
    ref.current = setInterval(() => setLeft((v) => {
      if (v == null) return v;
      if (v <= 1) {
        clearInterval(ref.current);
        try { new AudioContext(); } catch {}
        // simple beep
        try {
          const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
          const o = ac.createOscillator(); o.connect(ac.destination); o.frequency.value = 880;
          o.start(); setTimeout(() => o.stop(), 700);
        } catch {}
        return 0;
      }
      return v - 1;
    }), 1000);
  };
  return (
    <button className={"timer-btn" + (left != null ? " running" : "")} onClick={start}>
      ⏱ {left != null ? fmt(left) : label}
    </button>
  );
}

// cookFor: opened from a plan slot → show amounts for what that slot actually
// cooks (a dinner feeding tomorrow's lunch is cooked double), matching what the
// shopping list bought.
export default function RecipeModal({ recipe, onClose, cookFor }:
  { recipe: Recipe; onClose: () => void; cookFor?: { servings: number; household: number } }) {
  const s = useStore();
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [full, setFull] = useState(false);
  const [img, setImg] = useState<string | null>((recipe as any).image_url || null);

  const view = draft || recipe;
  const allergyHits = dietConflicts(view, s.settings.diet);
  const scale = cookFor && view.servings ? cookFor.servings / view.servings : 1;
  const leftovers = cookFor ? Math.max(0, cookFor.servings - cookFor.household) : 0;

  // Cooking a different batch size → Gemini rewrites the method (amounts inside
  // steps, pans, batching, a keep-the-leftovers step). Cached per recipe+batch
  // in localStorage so it's one call, ever; the original shows until it lands.
  const scaleKey = cookFor && scale !== 1 && !draft && view.id ? `scaled-method:${view.id}:${cookFor.servings}:${leftovers}` : null;
  const [scaledSteps, setScaledSteps] = useState<string[] | null>(null);
  const [scaling, setScaling] = useState(false);
  useEffect(() => {
    setScaledSteps(null);
    if (!scaleKey) return;
    try { const hit = localStorage.getItem(scaleKey); if (hit) { setScaledSteps(JSON.parse(hit)); return; } } catch {}
    let live = true;
    setScaling(true);
    api.scaleMethod({ recipe: view, servings: cookFor!.servings, leftovers })
      .then((r) => {
        if (!live || !r?.instructions?.length) return;
        setScaledSteps(r.instructions);
        try { localStorage.setItem(scaleKey, JSON.stringify(r.instructions)); } catch {}
      })
      .catch(() => {})
      .finally(() => live && setScaling(false));
    return () => { live = false; };
  }, [scaleKey]);
  const steps: string[] = scaledSteps || view.instructions || [];

  const runRemix = async (instr: string) => {
    setBusy(true); setMsg("Adapting…");
    try {
      const res = await api.remix(view, instr);
      if (res.error) setMsg(res.error);
      else { setDraft(res); setMsg("Done — review, then save as a new recipe."); }
    } catch { setMsg("Adapt failed (Gemini key set?)."); }
    setBusy(false);
  };
  const remix = async () => {
    if (!instruction.trim()) return;
    setBusy(true); setMsg("");
    try {
      const res = await api.remix(view, instruction.trim());
      if (res.error) setMsg(res.error);
      else { setDraft(res); setMsg("Remixed — review, then save."); }
    } catch { setMsg("Remix failed (Gemini key set?)."); }
    setBusy(false);
  };
  const save = async () => {
    setBusy(true);
    const res = await api.createRecipe({ ...draft, image_url: img });
    if (res.ok) {
      await s.refreshRecipes();
      // If the recipe we remixed is in the current plan, swap the new version in
      // so the plan and shopping list update (otherwise the old ingredients —
      // e.g. fennel — linger in the list). Browsing-only remixes just save.
      const inPlan = !!recipe.id && s.plan.some((p) => p.recipe_id === recipe.id);
      if (inPlan && res.id) {
        s.replacePlanRecipe(recipe.id, res.id);
        setMsg("Saved and swapped into your plan — shopping list updated.");
      } else {
        setMsg("Saved to your recipes.");
      }
    } else {
      setMsg(res.error || "Save failed.");
    }
    setBusy(false);
  };
  const genImage = async () => {
    setBusy(true); setMsg("Generating image…");
    try {
      const res = await api.generateImage(view.id || "", view.name, view.description || "");
      if (res.image_url) { setImg(res.image_url); setMsg("Image added."); s.refreshRecipes(); }
      else setMsg(res.error || "Image failed.");
    } catch { setMsg("Image generation failed."); }
    setBusy(false);
  };

  const card = (
    <>
      {img && <img className="recipe-img" src={img} alt={view.name} />}
      <h2>{view.name}</h2>
      {allergyHits.size > 0 && (
        <div className="banner allergy">⚠️ Not safe for your allergies — {[...allergyHits].map(([a, line]) => `${a} (${line})`).join(", ")}.</div>
      )}
      <p className="meta">{view.total_time} min · {cookFor && scale !== 1
          ? <>cook for {cookFor.servings}{leftovers ? ` (${cookFor.household} now + ${leftovers} leftovers)` : ""} · recipe serves {view.servings}</>
          : <>serves {view.servings}{leftovers ? ` (${cookFor!.household} now + ${leftovers} leftovers)` : ""}</>}
        {view.primary_protein ? ` · ${view.primary_protein === "none" ? "veg" : view.primary_protein}` : ""}
        {draft ? " · remixed (unsaved)" : ""}</p>

      <div className="actions" style={{ margin: "10px 0", flexWrap: "wrap" }}>
        <button className="btn" disabled={busy} onClick={genImage}>{img ? "Regenerate image" : "🖼 Generate image"}</button>
        {img && !draft && <button className="btn ghost" disabled={busy} onClick={async () => {
          setBusy(true); await api.createRecipe({ ...view, image_url: img }); s.refreshRecipes();
          setBusy(false); setMsg("Saved with image."); }}>Save image</button>}
      </div>

      <div className="cook-cols">
        <div>
          <h3>Ingredients</h3>
          <ul className="ing-list">
            {(view.ingredients || []).map((i: any, k: number) => (
              <li key={k}>{i.quantity ? `${fmtQty(i.quantity * scale)}${dispUnit(i.unit) ? " " + dispUnit(i.unit) : ""} ` : ""}{i.name}</li>))}
          </ul>
        </div>
        {steps.length > 0 && (
          <div>
            <h3>Method{scaledSteps ? <small className="muted"> · adjusted for {cookFor!.servings}</small>
              : scaling ? <small className="muted"> · adjusting for {cookFor!.servings}…</small> : null}</h3>
            <ol className="steps">
              {steps.map((st, k) => {
                const t = stepTimer(st);
                return <li key={k}>{st}{t ? <> <Timer seconds={t} label={fmt(t)} /></> : null}</li>;
              })}
            </ol>
          </div>
        )}
      </div>

      <div className="remix-box">
        <h3>Adapt this recipe</h3>
        <div className="chips" style={{ margin: "0 0 8px" }}>
          {[...recipeAllergens(view).keys()].map((a) => (
            <button key={a} className="chip" disabled={busy} onClick={() => runRemix(MAKE_FREE[a].ask)}>
              {MAKE_FREE[a].label}</button>
          ))}
          <button className="chip" disabled={busy}
            onClick={() => runRemix("Halve all quantities, keep the method.")}>½ Halve it</button>
        </div>
        <div className="add-row">
          <input placeholder='or type your own: "swap chicken for tofu", "make it spicier"…'
            value={instruction} onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") remix(); }} />
          <button className="btn" disabled={busy} onClick={remix}>{busy ? "…" : "Remix"}</button>
        </div>
        {busy && <div className="remix-progress"><div className="bar" /></div>}
        {msg && <p className="muted small">{msg}</p>}
        {draft && <button className="btn dark" disabled={busy} onClick={save}>Save as new recipe</button>}
      </div>
    </>
  );

  if (full) {
    return (
      <div className="cook-mode">
        <div className="cook-top">
          <button className="btn ghost" onClick={() => setFull(false)}>← Exit fullscreen</button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div className="cook-full-body">{card}</div>
      </div>
    );
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}>✕</button>
        <button className="fs-btn" onClick={() => setFull(true)}>⛶ Fullscreen</button>
        {card}
      </div>
    </div>
  );
}
