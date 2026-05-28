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

  const view = draft || recipe;

  const remix = async () => {
    if (!instruction.trim()) return;
    setBusy(true); setMsg("");
    try {
      const res = await api.remix(view, instruction.trim());
      if (res.error) setMsg(res.error);
      else { setDraft(res); setMsg("Remixed — review below, then save if you like it."); }
    } catch { setMsg("Remix failed (is the Gemini key set?)."); }
    setBusy(false);
  };

  const save = async () => {
    setBusy(true);
    const res = await api.createRecipe(draft);
    setBusy(false);
    if (res.ok) { s.refreshRecipes(); setMsg("Saved to your recipes."); }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}>✕</button>
        <h2>{view.name}</h2>
        <p className="meta">{view.total_time} min · serves {view.servings}
          {view.primary_protein && view.primary_protein !== "none" ? ` · ${view.primary_protein}` : ""}
          {draft ? " · remixed (unsaved)" : ""}</p>

        <h3>Ingredients</h3>
        <ul className="ing-list">
          {(view.ingredients || []).map((i: any, k: number) => (
            <li key={k}>{i.quantity ? `${i.quantity} ${i.unit || ""} ` : ""}{i.name}</li>
          ))}
        </ul>
        {view.instructions?.length > 0 && <>
          <h3>Method</h3>
          <ol className="steps">{view.instructions.map((st: string, k: number) => <li key={k}>{st}</li>)}</ol>
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
