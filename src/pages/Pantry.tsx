import React, { useState } from "react";
import { useStore } from "../store.tsx";
import { api } from "../lib/api.ts";

export default function Pantry() {
  const s = useStore();
  const [text, setText] = useState("");
  const [scanMsg, setScanMsg] = useState("");

  const onScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setScanMsg("Scanning photo…");
    try {
      const images = await Promise.all(files.map(async (f) => ({
        mime: f.type || "image/jpeg",
        data: await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result).split(",")[1]);
          r.onerror = rej;
          r.readAsDataURL(f);
        }),
      })));
      const res = await api.scanPantry(images);
      if (res.count) { await s.refreshPantry?.(); setScanMsg(`Added ${res.count} item${res.count > 1 ? "s" : ""}.`); }
      else setScanMsg(res.error ? "Scan failed — add items manually." : "No items detected — try a clearer photo.");
    } catch { setScanMsg("Scan failed (Gemini key set?). You can add items manually."); }
    e.target.value = "";
    setTimeout(() => setScanMsg(""), 5000);
  };

  return (
    <div>
      <h1>My Pantry</h1>
      <p className="muted">Whatever's here automatically feeds the meal planner — it's one input
        among seasonality, cost and your favourites, not the only one. The planner favours recipes
        that use what you already have, and leaves these off your shopping list.</p>

      <div className="scan-row">
        <label className="btn">📷 Take photo
          <input type="file" accept="image/*" capture="environment" hidden
            onChange={onScan} />
        </label>
        <label className="btn">🖼 Choose image
          <input type="file" accept="image/*" multiple hidden onChange={onScan} />
        </label>
        {scanMsg && <span className="muted small">{scanMsg}</span>}
      </div>

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
      {!s.pantry.length && <p className="muted">Nothing yet. Add a few staples and the planner will use them.</p>}
    </div>
  );
}
