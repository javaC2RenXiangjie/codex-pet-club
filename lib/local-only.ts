export function localOnlyResponse(request: Request) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") {
    return null;
  }
  return new Response("Not Found", {
    status: 404,
    headers: { "cache-control": "private, no-store" },
  });
}
