import { userAuthErrorResponse, verifyEmailCode } from "../../../../lib/user-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = await request.json() as {
      email?: unknown;
      code?: unknown;
      displayName?: unknown;
    };
    const result = await verifyEmailCode(request, input);
    return Response.json(
      { user: result.user },
      {
        headers: {
          "cache-control": "private, no-store",
          "set-cookie": result.cookie,
        },
      },
    );
  } catch (error) {
    return userAuthErrorResponse(error);
  }
}
