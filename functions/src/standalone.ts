// Standalone sign-in server: authNonce and authVerify outside Cloud Functions, for running SolFit's
// wallet sign-in on an ordinary Node host while Firebase stays on the free plan. Same handlers as
// index.ts (auth/handlers.ts); only the HTTP wrapper differs. Locked In jobs are not served here.
//
// Environment (values never logged):
//   AUTH_NONCE_SECRET               HMAC key for sign-in nonces (same role as the Functions secret), or
//   AUTH_NONCE_SECRET_FILE          path to a file holding it
//   GOOGLE_APPLICATION_CREDENTIALS  path to the solfit-prod-2026 service-account key file, or
//   FIREBASE_SERVICE_ACCOUNT        that key's JSON, for hosts that only take env values
//   PORT                            listen port (default 8080)
// The app is native and sends no Origin header, so no CORS headers are served.
import { readFileSync } from "node:fs";
import http from "node:http";
import { cert, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { checkSignIn, completeSignIn, signInPayload } from "./auth/handlers.ts";

// GCLOUD_PROJECT is set by `firebase emulators:exec` (a demo- project) so tests never reach production.
const PROJECT_ID = process.env.GCLOUD_PROJECT || "solfit-prod-2026";
const MAX_BODY_BYTES = 16 * 1024;

// AUTH_NONCE_SECRET_FILE lets a host mount the secret as a file (e.g. Render secret files) so it never
// has to pass through a command line.
const secretFile = process.env.AUTH_NONCE_SECRET_FILE;
const nonceSecret = (process.env.AUTH_NONCE_SECRET || (secretFile ? readFileSync(secretFile, "utf8") : "")).trim();
if (nonceSecret.length < 32) {
  console.error("AUTH_NONCE_SECRET must be set (32+ characters)");
  process.exit(1);
}

if (!getApps().length) {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const key = inline ? JSON.parse(inline) : keyFile ? JSON.parse(readFileSync(keyFile, "utf8")) : null;
  // A key from any other project (e.g. the original Kinlog one) would issue tokens that project's
  // Auth accepts; refuse to start rather than run against the wrong project.
  if (key && key.project_id !== PROJECT_ID) {
    console.error(`service-account key is for a different project than ${PROJECT_ID}; refusing to start`);
    process.exit(1);
  }
  initializeApp({
    projectId: PROJECT_ID,
    credential: key ? cert(key) : applicationDefault(),
  });
}
console.log(`sign-in server project: ${PROJECT_ID}`);
const db = getFirestore();
const auth = getAuth();

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

// Resolves undefined for a body over MAX_BODY_BYTES (the rest is drained so a 413 can still be sent),
// null for anything that isn't JSON.
function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size <= MAX_BODY_BYTES) chunks.push(c);
    });
    req.on("end", () => {
      if (size > MAX_BODY_BYTES) return resolve(undefined);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "null"));
      } catch {
        resolve(null);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  const path = (req.url ?? "/").split("?")[0];
  try {
    if (path === "/healthz") return send(res, 200, { ok: true });

    if (path === "/authNonce") {
      if (req.method !== "GET" && req.method !== "POST") return send(res, 405, { error: "method_not_allowed" });
      return send(res, 200, signInPayload(nonceSecret, Date.now()));
    }

    if (path === "/authVerify") {
      if (req.method !== "POST") return send(res, 405, { error: "method_not_allowed" });
      const body = await readJson(req);
      if (body === undefined) return send(res, 413, { error: "invalid_request" });
      const now = Date.now();
      const check = checkSignIn(nonceSecret, body, now);
      if (!check.ok) return send(res, check.status, { error: check.error });
      const out = await completeSignIn(db, auth, check, now);
      return send(res, out.status, out.body);
    }

    send(res, 404, { error: "not_found" });
  } catch (e) {
    console.error("request failed:", e instanceof Error ? e.message : String(e));
    if (!res.headersSent) send(res, 500, { error: "internal" });
  }
});

// Requests are tiny; don't let slow clients hold sockets open (Node's default is 300 s).
server.headersTimeout = 10_000;
server.requestTimeout = 15_000;

server.listen(Number(process.env.PORT ?? 8080), () => {
  console.log(`sign-in server listening on ${process.env.PORT ?? 8080}`);
});
