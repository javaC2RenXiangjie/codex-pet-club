import {
  RegistryError,
  updateHomepagePresentation,
} from "../../../../../../lib/pet-registry";
import { adminOnlyResponse } from "../../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const blocked = await adminOnlyResponse(request);
  if (blocked) return blocked;
  try {
    const body = await request.json() as {
      isOfficial?: unknown;
      featured?: unknown;
      priority?: unknown;
    };
    const { id } = await context.params;
    return Response.json(
      await updateHomepagePresentation(id, body),
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Request body must be JSON" }, { status: 400 });
    }
    if (error instanceof RegistryError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "Unexpected registry error" }, { status: 500 });
  }
}
