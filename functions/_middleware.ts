// Gate for every request. groceree.store sits behind Cloudflare Access (email
// login), but the same app is also served on *.pages.dev with no gate at all —
// the API there answered anyone, spending the Gemini/Firecrawl keys and
// exposing the household's data. So:
//   1. *.pages.dev (production and every preview URL) → redirect to the gated domain.
//   2. /api/* must carry a valid Access JWT — signature checked against the
//      team's published keys, plus audience/issuer/expiry. Headers alone can be
//      forged; the signed token can't.
// Local dev (wrangler pages dev on localhost) has no Access and is let through.

const DOMAIN = "groceree.store";
const TEAM = "https://viableplanet.cloudflareaccess.com";
// Access application audience tag for groceree.store (not a secret).
const AUD = "a62b22a314b2987ba34f989988a32ce11bc3c23e04ac487480eed290c8dce8c9";

let jwks: { keys: (JsonWebKey & { kid: string })[]; at: number } | null = null;
async function signingKey(kid: string): Promise<CryptoKey | null> {
  // Access rotates keys; refetch hourly, or immediately on an unknown kid.
  if (!jwks || Date.now() - jwks.at > 3600_000 || !jwks.keys.some((k) => k.kid === kid)) {
    const res = await fetch(`${TEAM}/cdn-cgi/access/certs`);
    if (!res.ok) return null;
    jwks = { keys: (await res.json<any>()).keys, at: Date.now() };
  }
  const jwk = jwks.keys.find((k) => k.kid === kid);
  return jwk ? crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]) : null;
}

const b64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function validAccessJwt(token: string): Promise<boolean> {
  try {
    const [h, p, sig] = token.split(".");
    const header = JSON.parse(new TextDecoder().decode(b64url(h)));
    if (header.alg !== "RS256") return false;
    const key = await signingKey(header.kid);
    if (!key) return false;
    const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, b64url(sig), new TextEncoder().encode(`${h}.${p}`));
    if (!ok) return false;
    const claims = JSON.parse(new TextDecoder().decode(b64url(p)));
    const now = Date.now() / 1000;
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    return aud.includes(AUD) && claims.iss === TEAM && claims.exp > now && (claims.nbf ?? 0) <= now + 60;
  } catch {
    return false;
  }
}

const accessToken = (req: Request) =>
  req.headers.get("Cf-Access-Jwt-Assertion") ||
  /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(req.headers.get("Cookie") || "")?.[1] || null;

export const onRequest: PagesFunction = async (ctx) => {
  const url = new URL(ctx.request.url);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return ctx.next();

  if (url.hostname.endsWith(".pages.dev")) {
    return Response.redirect(`https://${DOMAIN}${url.pathname}${url.search}`, 302);
  }

  if (url.pathname.startsWith("/api/")) {
    const token = accessToken(ctx.request);
    if (!token || !(await validAccessJwt(token))) {
      return new Response(JSON.stringify({ error: "not signed in" }), {
        status: 401, headers: { "content-type": "application/json" },
      });
    }
  }
  return ctx.next();
};
