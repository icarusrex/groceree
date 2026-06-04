import React, { useState } from "react";
import { StoreProvider } from "./store.tsx";
import MealPlan from "./pages/MealPlan.tsx";
import Shop from "./pages/Shop.tsx";
import Pantry from "./pages/Pantry.tsx";
import Settings from "./pages/Settings.tsx";
import PriceTrends from "./components/PriceTrends.tsx";

type View = "plan" | "shop" | "pantry" | "prices" | "settings";

const NAV: { id: View; label: string }[] = [
  { id: "plan", label: "Meal Plan" },
  { id: "shop", label: "Shop" },
  { id: "pantry", label: "Pantry" },
  { id: "prices", label: "Prices" },
  { id: "settings", label: "Settings" },
];

export default function App() {
  const [view, setView] = useState<View>("plan");
  return (
    <StoreProvider>
      <div className="layout">
        <aside className="sidebar">
          <div className="brand">🛒 Groceree</div>
          <nav>
            {NAV.map((n) => (
              <button key={n.id} className={view === n.id ? "nav active" : "nav"}
                onClick={() => setView(n.id)}>{n.label}</button>
            ))}
          </nav>
          <div className="version">v{__APP_VERSION__}</div>
        </aside>
        <main className="content">
          {view === "plan" && <MealPlan />}
          {view === "shop" && <Shop />}
          {view === "pantry" && <Pantry />}
          {view === "prices" && (
            <div className="plan-wrap">
              <h1>Price Trends</h1>
              <PriceTrends />
            </div>
          )}
          {view === "settings" && <Settings />}
        </main>
      </div>
    </StoreProvider>
  );
}
