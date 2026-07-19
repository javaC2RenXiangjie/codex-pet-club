#!/usr/bin/env node

const baseUrl = (process.env.CODEX_PET_CLUB_API
  || "https://codex-pet-club.renxiangjie.workers.dev").replace(/\/$/u, "");
const email = process.env.CODEX_PET_SMOKE_EMAIL?.trim() ?? "";

if (!email) {
  throw new Error("CODEX_PET_SMOKE_EMAIL is required");
}

const response = await fetch(`${baseUrl}/api/auth/request-code`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "user-agent": "Codex-Pet-Club-Production-Smoke/1.0",
  },
  body: JSON.stringify({ email }),
  signal: AbortSignal.timeout(60_000),
});
const payload = await response.json().catch(() => ({}));
if (response.status !== 200 || payload.ok !== true) {
  throw new Error(`Verification email request returned ${response.status}`);
}
if ("developmentCode" in payload) {
  throw new Error("Production unexpectedly returned a development verification code");
}

process.stdout.write(JSON.stringify({
  ok: true,
  delivery: "accepted",
  expiresInSeconds: payload.expiresInSeconds,
}) + "\n");
