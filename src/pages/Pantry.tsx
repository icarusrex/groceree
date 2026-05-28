import React, { useState } from "react";
import { useStore } from "../store.tsx";

export default function Pantry() {
  const s = useStore();
  const [text, setText] = useState("");
  return (
    <div>
      <h1>My Pantry</h1>
      <p className="muted">Items here are used as one input to the planner — it tries to use what you already have.</p>
      <div className="add-row">
        <input placeholder="e.g. 1kg rice, or olive oil" value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { s.addPantry(text.trim()); setText(""); } }} />
        <button className="btn" onClick={() => { if (text.trim()) { s.addPantry(text.trim()); setText(""); } }}>Add</button>
      </div>
      <h3>Your items ({s.pantry.length})</h3>
      {s.pantry.map((p) => (
        <div className="pantry-row" key={p.id}>
          <span>{p.raw_text}</span>
          <button className="icon" onClick={() => s.delPantry(p.id)}>🗑</button>
        </div>
      ))}
      {!s.pantry.length && <p className="muted">Nothing yet.</p>}
    </div>
  );
}
