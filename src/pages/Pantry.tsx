import React, { useState } from "react";
import { useStore } from "../store.tsx";
import { api } from "../lib/api.ts";
import RecipeModal from "../components/RecipeModal.tsx";
import type { Recipe } from "../engine/types.ts";

export default function Pantry() {
  const s = useStore();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [ideas, setIdeas] = useState<any[]>([]);
  const [open, setOpen] = useState<Recipe | null>(null);
  const [msg, setMsg] = useState("");

  const generate = async () => {
    setBusy(true); setMsg("Thinking up recipes from your pantry…"); setIdeas([]);
    try {
      const res = await api.pantryRecipes();
      if (res.recipes) { setIdeas(res.recipes); setMsg(""); }
      else setMsg(res.error || "Could not generate.");
    } catch { setMsg("Generation failed (Gemini key set?)."); }
    setBusy(false);
  };

  return (
    <div>
      <h1>My Pantry</h1>
      <p className="muted">Items here are used as one input to the planner — it tries to use what you already have, and won't add them to your shopping list.</p>
      <div className="add-row">
        <input placeholder="e.g. 1kg rice, or olive oil" value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { s.addPantry(text.trim()); setText(""); } }} />
        <button className="btn" onClick={() => { if (text.trim()) { s.addPantry(text.trim()); setText(""); } }}>Add</button>
      </div>

      <h3>Your items ({s.pantry.length})</h3>
      {s.pantry.map((p: any) => (
        <div className="pantry-row" key={p.id}>
          <span>{p.raw_text}</span>
          <button className="icon" onClick={() => s.delPantry(p.id)}>🗑</button>
        </div>
      ))}
      {!s.pantry.length && <p className="muted">Nothing yet.</p>}

      {s.pantry.length > 0 && (
        <div className="field" style={{ marginTop: 24 }}>
          <button className="btn dark" disabled={busy} onClick={generate}>
            {busy ? "…" : "🍳 Generate recipes from pantry"}</button>
          {msg && <p className="muted small">{msg}</p>}
          <div className="rail-list" style={{ maxHeight: "none", marginTop: 12 }}>
            {ideas.map((r, k) => (
              <div className="rail-item" key={k}>
                <div className="ri-main">
                  <div className="recipe-name link" onClick={() => setOpen(r)}>{r.name}</div>
                  <div className="meta">{r.total_time}m · serves {r.servings} · {r.primary_protein}</div>
                </div>
                <button className="btn" onClick={async () => {
                  const res = await api.createRecipe(r); if (res.ok) s.refreshRecipes();
                }}>Save</button>
              </div>
            ))}
          </div>
        </div>
      )}
      {open && <RecipeModal recipe={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
