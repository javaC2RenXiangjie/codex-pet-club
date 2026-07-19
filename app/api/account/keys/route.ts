import {
  createUserApiKey,
  listUserApiKeys,
  requireSessionUser,
  userAuthErrorResponse,
} from "../../../../lib/user-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser(request);
    return Response.json(
      { keys: await listUserApiKeys(request, user.id), maxActiveKeys: 3 },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return userAuthErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSessionUser(request);
    const input = await request.json() as { name?: unknown };
    return Response.json(
      { key: await createUserApiKey(request, user.id, input.name) },
      { status: 201, headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return userAuthErrorResponse(error);
  }
}
