import React, { useEffect, useRef, useState } from "react";
import { useStore } from "../store.tsx";
import { api } from "../lib/api.ts";
import type { Recipe } from "../engine/types.ts";

// pull "10 minutes" / "1 hour" durations out of a step → seconds
function stepTimer(text: string): number | null {
  const m = text.match(/(\d+)\s*(?:-\s*\d+\s*)?(hour|hr|minute|min)/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return /h/i.test(m[2]) ? n * 3600 : n * 60;
}
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

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

export default function RecipeModal({ recipe, onClose }:
  { recipe: Recipe; onClose: () => void }) {
  const s = useStore();
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [full, setFull] = useState(false);
  const [img, setImg] = useState<string | null>((recipe as any).image_url || null);

  const view = draft || recipe;
  const steps: string[] = view.instructions || [];

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
    setBusy(false);
    if (res.ok) { s.refreshRecipes(); setMsg("Saved to your recipes."); }
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
      <p className="meta">{view.total_time} min · serves {view.servings}
        {view.primary_protein && view.primary_protein !== "none" ? ` · ${view.primary_protein}` : ""}
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
              <li key={k}>{i.quantity ? `${i.quantity} ${i.unit || ""} ` : ""}{i.name}</li>))}
          </ul>
        </div>
        {steps.length > 0 && (
          <div>
            <h3>Method</h3>
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
          {!view.is_gluten_free && (
            <button className="chip" disabled={busy}
              onClick={() => runRemix("Make this gluten-free. Swap only what's necessary (e.g. gluten-free pasta/flour, tamari instead of soy sauce, cornflour to thicken). Keep everything else the same and note if a swap changes the method.")}>
              🌾 Make gluten-free</button>
          )}
          {!view.is_dairy_free && (
            <button className="chip" disabled={busy}
              onClick={() => runRemix("Make this dairy-free with simple swaps, keeping it cookable.")}>
              🥛 Make dairy-free</button>
          )}
          <button className="chip" disabled={busy}
            onClick={() => runRemix("Halve all quantities, keep the method.")}>½ Halve it</button>
        </div>
        <div className="add-row">
          <input placeholder='or type your own: "swap chicken for tofu", "make it spicier"…'
            value={instruction} onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") remix(); }} />
          <button className="btn" disabled={busy} onClick={remix}>{busy ? "…" : "Remix"}</button>
        </div>
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
