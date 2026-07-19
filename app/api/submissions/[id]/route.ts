import {
  getCreatorSubmission,
  RegistryError,
} from "../../../../lib/pet-registry";
import {
  currentUser,
  userAuthErrorResponse,
} from "../../../../lib/user-auth";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await currentUser(request);
    const { id } = await context.params;
    return Response.json(
      { submission: await getCreatorSubmission(id, user.id) },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof RegistryError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return userAuthErrorResponse(error);
  }
}
