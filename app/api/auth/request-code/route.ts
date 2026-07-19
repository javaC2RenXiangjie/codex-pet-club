import { requestEmailCode, userAuthErrorResponse } from "../../../../lib/user-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = await request.json() as { email?: unknown };
    return Response.json(
      await requestEmailCode(request, input.email),
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return userAuthErrorResponse(error);
  }
}
