import { json, uid, type Env } from "./_helpers.ts";

// GET /api/spend?week_start=YYYY-MM-DD → grocery spend from scanned receipts:
// this week (Mon–Sun from week_start) and this calendar month. The weekly bar
// fills from these; Actual Budget stays the real ledger.
export const onRequestGet: PagesFunction<Env> = async (ctx) => {
  const url = new URL(ctx.request.url);
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("week_start") || "")
    ? url.searchParams.get("week_start")! : today;
  const user = uid(ctx);
  const sum = (from: string, to: string) => ctx.env.DB.prepare(
    `SELECT COALESCE(SUM(COALESCE(grocery_total, total)),0) AS spent, COUNT(*) AS n
     FROM receipts WHERE user_id=? AND date>=? AND date<=?`,
  ).bind(user, from, to).first<{ spent: number; n: number }>();
  const end = new Date(weekStart + "T00:00:00Z"); end.setUTCDate(end.getUTCDate() + 6);
  const monthStart = today.slice(0, 8) + "01";
  const [week, month] = await Promise.all([sum(weekStart, end.toISOString().slice(0, 10)), sum(monthStart, today)]);
  return json({
    week: { from: weekStart, spent: Math.round((week?.spent || 0) * 100) / 100, receipts: week?.n || 0 },
    month: { from: monthStart, spent: Math.round((month?.spent || 0) * 100) / 100, receipts: month?.n || 0 },
  });
};
