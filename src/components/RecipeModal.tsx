import React, { useState } from "react";
import { useStore } from "../store.tsx";
import { api } from "../lib/api.ts";
import type { Recipe } from "../engine/types.ts";

export default function RecipeModal({ recipe, onClose }:
  { recipe: Recipe; onClose: () => void }) {
  const s = useStore();
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<any>(null);
  const [msg, setMsg] = useState("");
  const [cooking, setCooking] = useState(false);
  const [img, setImg] = useState<string | null>((recipe as any).image_url || null);
  const [step, setStep] = useState(0);

  const view = draft || recipe;
  const steps: string[] = view.instructions || [];

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

  if (cooking) {
    return (
      <div className="cook-mode">
        <div className="cook-top">
          <button className="btn ghost" onClick={() => setCooking(false)}>← Back</button>
          <h2>{view.name}</h2>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div className="cook-body">
          <div className="cook-ings">
            <h3>Ingredients</h3>
            <ul>{(view.ingredients || []).map((i: any, k: number) => (
              <li key={k}>{i.quantity ? `${i.quantity} ${i.unit || ""} ` : ""}{i.name}</li>))}</ul>
          </div>
          <div className="cook-steps">
            <div className="cook-step-num">Step {step + 1} of {steps.length}</div>
            <div className="cook-step-text">{steps[step] || "No steps recorded for this recipe."}</div>
            <div className="cook-nav">
              <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>Previous</button>
              <button className="btn dark" disabled={step >= steps.length - 1} onClick={() => setStep(step + 1)}>Next step</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}>✕</button>
        {img && <img className="recipe-img" src={img} alt={view.name} />}
        <h2>{view.name}</h2>
        <p className="meta">{view.total_time} min · serves {view.servings}
          {view.primary_protein && view.primary_protein !== "none" ? ` · ${view.primary_protein}` : ""}
          {draft ? " · remixed (unsaved)" : ""}</p>

        <div className="actions" style={{ margin: "10px 0", flexWrap: "wrap" }}>
          {steps.length > 0 && <button className="btn dark" onClick={() => { setStep(0); setCooking(true); }}>👨‍🍳 Cooking mode</button>}
          <button className="btn" disabled={busy} onClick={genImage}>{img ? "Regenerate image" : "🖼 Generate image"}</button>
          {img && !draft && <button className="btn ghost" disabled={busy} onClick={async () => {
            setBusy(true); await api.createRecipe({ ...view, image_url: img }); s.refreshRecipes();
            setBusy(false); setMsg("Saved with image."); }}>Save image</button>}
        </div>

        <h3>Ingredients</h3>
        <ul className="ing-list">
          {(view.ingredients || []).map((i: any, k: number) => (
            <li key={k}>{i.quantity ? `${i.quantity} ${i.unit || ""} ` : ""}{i.name}</li>))}
        </ul>
        {steps.length > 0 && <>
          <h3>Method</h3>
          <ol className="steps">{steps.map((st, k) => <li key={k}>{st}</li>)}</ol>
        </>}

        <div className="remix-box">
          <h3>Remix this recipe</h3>
          <div className="add-row">
            <input placeholder='e.g. "make it dairy-free", "halve it", "swap chicken for tofu"'
              value={instruction} onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") remix(); }} />
            <button className="btn" disabled={busy} onClick={remix}>{busy ? "…" : "Remix"}</button>
          </div>
          {msg && <p className="muted small">{msg}</p>}
          {draft && <button className="btn dark" disabled={busy} onClick={save}>Save as new recipe</button>}
        </div>
      </div>
    </div>
  );
}
