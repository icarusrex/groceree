import { json, uid, ensureSettings, type Env } from "./_helpers.ts";

// Export the current shopping list to Notion as a new sub-page of the user's
// chosen parent page: one heading_3 per category, one to_do per item, so it is
// tickable in the Notion phone app while standing in the shop.
//
// Two separate pieces of config, deliberately:
//   NOTION_TOKEN  - server secret, the APP's integration, shared by all users
//                   (wrangler pages secret put NOTION_TOKEN)
//   notion_parent_id - per-user setting, since each person on the Access
//                   allowlist has their own Notion.
const NOTION_VERSION = "2022-06-28";
const MAX_CHILDREN = 100; // Notion's hard cap per create/append call

// Accepts a bare id, a dashed uuid, or any Notion URL (the id is the last
// 32 hex chars of the slug, with ?v= / #anchor junk stripped).
export function parsePageId(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  const hex = s.replace(/[?#].*$/, "").match(/[0-9a-fA-F]{32}/g);
  if (hex?.length) return hex[hex.length - 1].toLowerCase();
  const dashed = s.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  return dashed ? dashed[0].replace(/-/g, "").toLowerCase() : null;
}

const text = (content: string) => [{ type: "text", text: { content: content.slice(0, 2000) } }];

const heading = (s: string) => ({
  object: "block", type: "heading_3", heading_3: { rich_text: text(s) },
});

const todo = (s: string) => ({
  object: "block", type: "to_do", to_do: { rich_text: text(s), checked: false },
});

interface Group { category: string; items: { name: string; amount?: string }[] }

export function buildBlocks(groups: Group[]): any[] {
  const blocks: any[] = [];
  for (const g of groups) {
    if (!g.items?.length) continue;
    blocks.push(heading(g.category));
    for (const i of g.items) {
      blocks.push(todo(i.amount ? `${i.name} · ${i.amount}` : i.name));
    }
  }
  return blocks;
}

async function notion(token: string, path: string, method: string, body: unknown) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json<any>().catch(() => ({}));
  if (!res.ok) {
    // 404 here almost always means the page exists but has not been shared with
    // the integration - the one setup step that is easy to miss, so name it.
    const hint = res.status === 404
      ? " — check the parent page is shared with the integration (Notion page → ••• → Connections → add it)"
      : "";
    throw new Error(`notion ${res.status}: ${data?.message || "request failed"}${hint}`);
  }
  return data;
}

export const onRequestPost: PagesFunction<Env> = async (ctx) => {
  const token = ctx.env.NOTION_TOKEN;
  if (!token) {
    return json({ error: "Notion is not configured on the server (NOTION_TOKEN secret is unset)." }, 501);
  }

  const user = uid(ctx);
  const row = await ensureSettings(ctx.env.DB, user) as any;
  const parent = parsePageId(row?.notion_parent_id || "");
  if (!parent) {
    return json({ error: "No Notion page chosen yet — paste the page URL in Settings first." }, 400);
  }

  const body = await ctx.request.json<{ title?: string; groups?: Group[] }>();
  const groups = (body.groups || []).filter((g) => g?.items?.length);
  if (!groups.length) return json({ error: "Nothing to export — the list is empty." }, 400);

  const blocks = buildBlocks(groups);
  const title = body.title || `Shopping List — ${new Date().toISOString().slice(0, 10)}`;

  try {
    const page = await notion(token, "/pages", "POST", {
      parent: { page_id: parent },
      properties: { title: { title: text(title) } },
      children: blocks.slice(0, MAX_CHILDREN),
    });

    // A long list overflows Notion's 100-block create limit; append the rest.
    for (let i = MAX_CHILDREN; i < blocks.length; i += MAX_CHILDREN) {
      await notion(token, `/blocks/${page.id}/children`, "PATCH",
        { children: blocks.slice(i, i + MAX_CHILDREN) });
    }

    return json({ ok: true, url: page.url, id: page.id, items: blocks.length - groups.length });
  } catch (e: any) {
    return json({ error: String(e?.message || e) }, 502);
  }
};
