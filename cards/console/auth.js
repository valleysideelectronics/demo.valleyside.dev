/*
 * Staff sign-in for the hosted console: Cognito's own sign-in page (which
 * handles passwords and the required authenticator-app code), then the
 * standard authorization-code flow with PKCE. No password ever touches this
 * page, and there is no client secret to leak.
 *
 * Tokens live in memory; only the refresh token is kept in sessionStorage so a
 * reload doesn't mean signing in again. Closing the tab ends the session.
 *
 * config: { authDomain, clientId, redirect } from the page's
 * <meta name="console-hosted">. With { auth: "dev" } it instead offers a
 * pick-a-role sign-in for the local dev server, whose tokens a real deployment
 * rejects (they aren't signed by Cognito).
 */
const KEY = "lcconsole.session";
const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const randomString = (n = 48) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const ss = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
  del: (k) => { try { sessionStorage.removeItem(k); } catch {} },
};

/** The claims inside a JWT, for display only. The API checks the signature. */
export function claimsOf(token) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part), (c) => c.charCodeAt(0))));
  } catch { return {}; }
}

export function createAuth(config) {
  let idToken = null, expiresAt = 0;
  const redirect = config.redirect || location.origin + location.pathname;
  const tokenUrl = `${config.authDomain}/oauth2/token`;

  async function tokenRequest(params) {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.clientId, ...params }),
    });
    if (!res.ok) throw new Error(`sign-in failed (${res.status})`);
    const t = await res.json();
    idToken = t.id_token;
    expiresAt = Date.now() + (t.expires_in || 3600) * 1000;
    if (t.refresh_token) ss.set(KEY, t.refresh_token);
    return idToken;
  }

  const auth = {
    dev: config.auth === "dev",

    /** Finishes a sign-in redirect if this page load is one. True when signed in. */
    async start() {
      if (auth.dev) {
        const saved = ss.get(KEY);
        if (saved) { idToken = saved; expiresAt = Infinity; }
        return !!idToken;
      }
      const q = new URLSearchParams(location.search);
      if (q.has("code")) {
        const expected = ss.get(KEY + ".state"), verifier = ss.get(KEY + ".verifier");
        ss.del(KEY + ".state"); ss.del(KEY + ".verifier");
        history.replaceState(null, "", location.pathname + location.hash);
        if (!expected || q.get("state") !== expected || !verifier) throw new Error("that sign-in link was stale; sign in again");
        await tokenRequest({ grant_type: "authorization_code", code: q.get("code"), redirect_uri: redirect, code_verifier: verifier });
        return true;
      }
      if (q.has("error")) {
        history.replaceState(null, "", location.pathname + location.hash);
        throw new Error(q.get("error_description") || q.get("error"));
      }
      if (ss.get(KEY)) {
        try { await tokenRequest({ grant_type: "refresh_token", refresh_token: ss.get(KEY) }); return true; }
        catch { ss.del(KEY); }
      }
      return false;
    },

    /** Sends the browser to the sign-in page. */
    async signIn() {
      const verifier = randomString(48), state = randomString(16);
      const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
      ss.set(KEY + ".verifier", verifier);
      ss.set(KEY + ".state", state);
      location.assign(`${config.authDomain}/oauth2/authorize?` + new URLSearchParams({
        response_type: "code", client_id: config.clientId, redirect_uri: redirect,
        scope: "openid email profile", state, code_challenge_method: "S256", code_challenge: challenge,
      }));
    },

    /** Local dev server only: a fake token carrying the chosen role. */
    devSignIn(email, role) {
      const enc = (o) => b64url(new TextEncoder().encode(JSON.stringify(o)));
      idToken = `dev.${enc({ sub: "dev-" + role, email, "cognito:groups": [role] })}.x`;
      expiresAt = Infinity;
      ss.set(KEY, idToken);
    },

    /** A current ID token, refreshed a minute before it expires. */
    async token() {
      if (idToken && Date.now() < expiresAt - 60000) return idToken;
      if (!auth.dev && ss.get(KEY)) return tokenRequest({ grant_type: "refresh_token", refresh_token: ss.get(KEY) });
      throw Object.assign(new Error("signed out"), { signedOut: true });
    },

    who() {
      const c = claimsOf(idToken || "");
      const groups = c["cognito:groups"] || [];
      const role = ["admin", "issuer", "viewer"].find((r) => groups.includes(r)) || null;
      return { email: c.email || "", role };
    },

    /** Revokes the session everywhere it can, then shows the sign-in page's logout. */
    async signOut() {
      const refresh = ss.get(KEY);
      ss.del(KEY);
      idToken = null;
      if (auth.dev) { location.reload(); return; }
      if (refresh) {
        try {
          await fetch(`${config.authDomain}/oauth2/revoke`, {
            method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ token: refresh, client_id: config.clientId }),
          });
        } catch {}
      }
      location.assign(`${config.authDomain}/logout?` + new URLSearchParams({ client_id: config.clientId, logout_uri: redirect }));
    },
  };
  return auth;
}
