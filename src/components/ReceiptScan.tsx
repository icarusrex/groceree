import React, { useState } from "react";
import { api } from "../lib/api.ts";
import { useStore } from "../store.tsx";

// Photo of a till receipt -> /api/scan-receipt -> real, non-promotional prices
// logged per store over time. Same "honest signal" idea as the manual staple
// basket below it, just captured automatically instead of typed in.
export default function ReceiptScan({ onScanned }: { onScanned?: () => void }) {
  const [msg, setMsg] = useState("");
  const s = useStore();

  const onScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setMsg("Reading receipt…");
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
      const res = await api.scanReceipt(images);
      if (res.item_count) {
        const paid = res.total ?? res.grocery_total;
        setMsg(`${res.store}${res.date ? ` (${res.date})` : ""}: ${res.item_count} item${res.item_count > 1 ? "s" : ""}` +
          `${paid ? `, €${Number(paid).toFixed(2)}` : ""}` +
          `${res.prices_learned ? ` · ${res.prices_learned} price${res.prices_learned > 1 ? "s" : ""} learned` : ""}.`);
        s.refreshSpend();
        onScanned?.();
      } else {
        setMsg(res.error || "No items detected — try a clearer photo.");
      }
    } catch {
      setMsg("Scan failed (Gemini key set?).");
    }
    e.target.value = "";
    setTimeout(() => setMsg(""), 6000);
  };

  return (
    <div>
      <h3>Scan a receipt</h3>
      <p className="muted small" style={{ marginTop: 0 }}>
        Photo of a till receipt → what you actually paid. Counts toward this week's
        food budget and corrects the ingredient prices meal costs are estimated from.
      </p>
      <div className="scan-row">
        <label className="btn">📷 Take photo
          <input type="file" accept="image/*" capture="environment" hidden onChange={onScan} />
        </label>
        <label className="btn">🖼 Choose image
          <input type="file" accept="image/*" multiple hidden onChange={onScan} />
        </label>
        {msg && <span className="muted small">{msg}</span>}
      </div>
    </div>
  );
}
