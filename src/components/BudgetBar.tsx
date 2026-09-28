import React from "react";
import { useStore } from "../store.tsx";
import { PLANNED_MEALS_SHARE, weekBudget, type PlanCost } from "../engine/cost.ts";

const eur = (n: number) => `€${n < 10 ? n.toFixed(2) : Math.round(n)}`;

// This week against the food budget. Receipts are money spent; the plan is money
// about to be spent. Once you've shopped for the plan its cost is in the receipts,
// so the bar shows spent (solid) and extends to max(spent, planned) — never both.
export default function BudgetBar({ cost }: { cost: PlanCost }) {
  const s = useStore();
  const monthly = s.settings.monthly_food_budget;
  const planDays = new Set(s.plan.map((p) => p.day_of_week)).size || s.settings.plan_days;
  const priced = cost.coverage >= 0.5;
  const planned = priced ? cost.total : null;
  const pricing = s.pricing && <span> · pricing ingredients {s.pricing.done}/{s.pricing.total}…</span>;

  if (!monthly) {
    return (
      <div className="budget muted small">
        {planned != null ? <>Planned meals ≈ <b>{eur(planned)}</b></> : "Meal costs appear as ingredient prices come in"}
        {pricing} · set a monthly food budget in Settings to track the week.
      </div>
    );
  }

  const wb = weekBudget(monthly, s.spend?.month.spent ?? 0, planDays);
  const spent = s.spend?.week.spent ?? 0;
  const projected = Math.max(spent, planned ?? 0);
  const pct = (x: number) => `${Math.min(100, (x / wb.weekly) * 100)}%`;
  const over = projected > wb.weekly;
  return (
    <div className="budget">
      <div className="budget-line">
        <span>This week <b>{eur(projected)}</b> of {eur(wb.weekly)}</span>
        <span className="muted small">
          {eur(spent)} spent{s.spend?.week.receipts ? ` (${s.spend.week.receipts} receipt${s.spend.week.receipts > 1 ? "s" : ""})` : ""}
          {planned != null ? <> · plan ≈ {eur(planned)}</> : null}
          {" "}· month {eur(s.spend?.month.spent ?? 0)} of {eur(monthly)}
        </span>
      </div>
      <div className={"budget-track" + (over ? " over" : "")}>
        <div className="budget-planned" style={{ width: pct(projected) }} />
        <div className="budget-spent" style={{ width: pct(spent) }} />
      </div>
      <div className="muted small">
        {planned != null
          ? <>Meals aim for {eur(wb.planTarget)} over {planDays} days ({Math.round(PLANNED_MEALS_SHARE * 100)}% of the week's budget; the rest is breakfasts &amp; snacks). Excludes cupboard staples.</>
          : "Plan cost appears once most ingredients are priced."}
        {cost.coverage > 0 && cost.coverage < 0.9 && planned != null ? ` ${Math.round(cost.coverage * 100)}% of ingredients priced.` : ""}
        {pricing}
      </div>
    </div>
  );
}
