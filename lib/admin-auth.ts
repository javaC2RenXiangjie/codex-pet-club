import { getPetRegistryBindings } from "./runtime-bindings";

function isLoopback(request: Request) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

async function sameToken(left: string, right: string) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(leftHash);
  const rightBytes = new Uint8Array(rightHash);
  let difference = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

export async function adminOnlyResponse(request: Request) {
  if (isLoopback(request)) return null;

  const configured = getPetRegistryBindings()?.ADMIN_TOKEN?.trim() ?? "";
  if (!configured) {
    return Response.json(
      { error: "Admin authentication is not configured" },
      { status: 503, headers: { "cache-control": "private, no-store" } },
    );
  }

  const supplied = bearerToken(request);
  if (!supplied || !(await sameToken(supplied, configured))) {
    return Response.json(
      { error: "Admin authentication required" },
      {
        status: 401,
        headers: {
          "cache-control": "private, no-store",
          "www-authenticate": "Bearer",
        },
      },
    );
  }
  return null;
}
