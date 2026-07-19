import {
  requireSessionUser,
  revokeUserApiKey,
  userAuthErrorResponse,
} from "../../../../../lib/user-auth";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireSessionUser(request);
    const { id } = await context.params;
    await revokeUserApiKey(request, user.id, id);
    return Response.json(
      { ok: true },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return userAuthErrorResponse(error);
  }
}
