// End-to-end check of the standalone sign-in server (src/standalone.ts) against a running instance,
// with a throwaway wallet. Run it against the emulators, never production:
//   firebase emulators:exec --only firestore,auth --project demo-solfit \
//     "node --experimental-strip-types functions/scripts/standalone-e2e.ts"
// It starts the server itself on a free port, with a random nonce secret.
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { Keypair } from "@solana/web3.js";
import { buildSignInMessage } from "../src/auth/siws.ts";
import { signBytes } from "../test/support/sign.ts";

if (!process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.GCLOUD_PROJECT?.startsWith("demo-")) {
  console.error("refusing to run outside the emulators (demo- project)");
  process.exit(2);
}

const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const server = spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", new URL("../src/standalone.ts", import.meta.url).pathname], {
  env: { ...process.env, PORT: String(PORT), AUTH_NONCE_SECRET: crypto.randomBytes(32).toString("hex") },
  stdio: ["ignore", "inherit", "inherit"],
});

let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed++;
};

async function verify(body: unknown) {
  const res = await fetch(`${BASE}/authVerify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: res.status, body: (await res.json()) as Record<string, string> };
}

async function signedBody(kp: Keypair) {
  const p = (await (await fetch(`${BASE}/authNonce`)).json()) as Record<string, string>;
  const text = buildSignInMessage({ ...p, address: kp.publicKey.toBase58() } as Parameters<typeof buildSignInMessage>[0]);
  const bytes = Buffer.from(text, "utf8");
  return { address: kp.publicKey.toBase58(), message: bytes.toString("base64"), signature: signBytes(kp, bytes).toString("base64") };
}

try {
  for (let i = 0; i < 50; i++) {
    if (await fetch(`${BASE}/healthz`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  check("healthz", (await fetch(`${BASE}/healthz`)).ok);

  const kp = Keypair.generate();
  const body = await signedBody(kp);

  const ok = await verify(body);
  check("valid signature gets a token", ok.status === 200 && typeof ok.body.token === "string", `HTTP ${ok.status}`);

  // The token must be accepted by Firebase Auth and carry the wallet as uid.
  const ex = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: ok.body.token, returnSecureToken: true }) },
  );
  const idTok = ((await ex.json()) as { idToken?: string }).idToken ?? "";
  const uid = idTok ? JSON.parse(Buffer.from(idTok.split(".")[1], "base64url").toString()).user_id : "";
  check("token signs in to Firebase Auth as the wallet", ex.ok && uid === kp.publicKey.toBase58());

  const replay = await verify(body);
  check("replayed nonce refused", replay.status === 409 && replay.body.error === "nonce_used", `HTTP ${replay.status}`);

  const other = Keypair.generate();
  const fresh = await signedBody(kp);
  const forged = await verify({ ...fresh, signature: signBytes(other, Buffer.from(fresh.message, "base64")).toString("base64") });
  check("signature from another key refused", forged.status === 401 && forged.body.error === "invalid_signature", `HTTP ${forged.status}`);

  const swapped = await verify({ ...(await signedBody(kp)), address: other.publicKey.toBase58() });
  check("address not matching the message refused", swapped.status === 401, `HTTP ${swapped.status}`);

  const big = await fetch(`${BASE}/authVerify`, { method: "POST", body: "x".repeat(20_000) });
  check("oversized body gets 413", big.status === 413, `HTTP ${big.status}`);

  check("unknown path 404", (await fetch(`${BASE}/nope`)).status === 404);
} finally {
  server.kill();
}
process.exit(failed ? 1 : 0);
