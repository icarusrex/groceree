// Shared Firecrawl scrape helper. Firecrawl renders JS and gets past anti-bot,
// returning the fully-loaded page (links / rawHtml) that a plain fetch from a
// Cloudflare datacenter IP can't see.
export async function firecrawl(
  key: string,
  url: string,
  formats: string[] = ["links"],
  waitFor = 0,
): Promise<any> {
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ url, formats, onlyMainContent: false, ...(waitFor ? { waitFor } : {}) }),
  });
  if (!res.ok) throw new Error(`firecrawl ${res.status}: ${await res.text()}`);
  return res.json<any>();
}
