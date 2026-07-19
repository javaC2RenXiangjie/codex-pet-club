import {
  logoutSession,
  requireSessionUser,
  userAuthErrorResponse,
} from "../../../../lib/user-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return Response.json(
      { user: await requireSessionUser(request) },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return userAuthErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    return Response.json(
      { ok: true },
      {
        headers: {
          "cache-control": "private, no-store",
          "set-cookie": await logoutSession(request),
        },
      },
    );
  } catch (error) {
    return userAuthErrorResponse(error);
  }
}
