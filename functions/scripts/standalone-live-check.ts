// Checks a deployed standalone sign-in server with a throwaway wallet (never a real one):
//   node --experimental-strip-types functions/scripts/standalone-live-check.ts https://<host> [google-services.json]
// Negative cases must all be refused without a token. The one valid sign-in creates a Firebase Auth
// user and authNonces/authLinks documents for the throwaway address, printed at the end.
// With google-services.json, the issued token is exchanged with Firebase Auth to prove it is accepted.
import { readFileSync } from "node:fs";
import { Keypair } from "@solana/web3.js";
import { buildSignInMessage } from "../src/auth/siws.ts";
import { signBytes } from "../test/support/sign.ts";

const BASE = (process.argv[2] ?? "").replace(/\/+$/, "");
if (!BASE.startsWith("https://")) {
  console.error("usage: standalone-live-check.ts https://<host> [google-services.json]");
  process.exit(2);
}
const gs = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], "utf8")) : null;

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed++;
};

async function verify(body: unknown, raw?: string) {
  const res = await fetch(`${BASE}/authVerify`, { method: "POST", headers: { "content-type": "application/json" }, body: raw ?? JSON.stringify(body) });
  const out = (await res.json().catch(() => ({}))) as Record<string, string>;
  return { status: res.status, body: out, noToken: !("token" in out) };
}

async function signedBody(kp: Keypair, tweak: (p: Record<string, string>) => Record<string, string> = (p) => p) {
  const p = (await (await fetch(`${BASE}/authNonce`)).json()) as Record<string, string>;
  const text = buildSignInMessage({ ...tweak(p), address: kp.publicKey.toBase58() } as Parameters<typeof buildSignInMessage>[0]);
  const bytes = Buffer.from(text, "utf8");
  return { address: kp.publicKey.toBase58(), message: bytes.toString("base64"), signature: signBytes(kp, bytes).toString("base64") };
}

const kp = Keypair.generate();
const other = Keypair.generate();

const h = await fetch(`${BASE}/healthz`);
check("healthz", h.ok, `HTTP ${h.status}`);
const p = (await (await fetch(`${BASE}/authNonce`)).json()) as Record<string, string>;
check("nonce payload bound to solfit.digitiumlabs.com", p.domain === "solfit.digitiumlabs.com" && p.uri === "https://solfit.digitiumlabs.com");

const cases: [string, Promise<Awaited<ReturnType<typeof verify>>>, number][] = [
  ["malformed JSON", verify(null, "{not json"), 400],
  ["empty body", verify({}), 400],
  ["bad address", verify({ address: "nope", message: "aGk=", signature: "aGk=" }), 400],
  ["forged signature (other key)", (async () => {
    const b = await signedBody(kp);
    return verify({ ...b, signature: signBytes(other, Buffer.from(b.message, "base64")).toString("base64") });
  })(), 401],
  ["wrong wallet address", (async () => verify({ ...(await signedBody(kp)), address: other.publicKey.toBase58() }))(), 401],
  ["wrong domain in message", (async () => verify(await signedBody(kp, (q) => ({ ...q, domain: "evil.example" }))))(), 401],
  ["made-up nonce", (async () => verify(await signedBody(kp, (q) => ({ ...q, nonce: "0".repeat(74) }))))(), 401],
  ["oversized body", verify(null, JSON.stringify({ address: "x".repeat(20_000) })), 413],
];
for (const [name, pr, want] of cases) {
  const r = await pr;
  check(`${name} refused`, r.status === want && r.noToken, `HTTP ${r.status} ${r.body.error ?? ""}`);
}
const wrongMethod = await fetch(`${BASE}/authVerify`);
check("GET authVerify refused", wrongMethod.status === 405);

const good = await signedBody(kp);
const ok = await verify(good);
check("valid throwaway signature gets a token", ok.status === 200 && typeof ok.body.token === "string", `HTTP ${ok.status} ${ok.body.error ?? ""}`);
const replay = await verify(good);
check("replayed nonce refused", replay.status === 409 && replay.noToken, `HTTP ${replay.status} ${replay.body.error ?? ""}`);

if (gs && ok.body.token) {
  const apiKey = gs.client[0].api_key[0].current_key;
  const ex = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: ok.body.token, returnSecureToken: true }),
  });
  const j = (await ex.json()) as { idToken?: string; error?: { message?: string } };
  const claims = j.idToken ? JSON.parse(Buffer.from(j.idToken.split(".")[1], "base64url").toString()) : {};
  check(
    "Firebase Auth accepts the token; uid = wallet, project = solfit-prod-2026",
    ex.ok && claims.user_id === kp.publicKey.toBase58() && claims.aud === "solfit-prod-2026",
    ex.ok ? "" : `HTTP ${ex.status} ${j.error?.message ?? ""}`,
  );
}

console.log(`throwaway wallet used: ${kp.publicKey.toBase58()}`);
process.exit(failed ? 1 : 0);
