import {
  moderateSubmission,
  RegistryError,
} from "../../../../../lib/pet-registry";
import { adminOnlyResponse } from "../../../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const blocked = await adminOnlyResponse(request);
  if (blocked) return blocked;
  try {
    const body = (await request.json()) as {
      status?: unknown;
      reviewNote?: unknown;
    };
    if (body.status !== "published" && body.status !== "rejected") {
      throw new RegistryError("status must be published or rejected");
    }
    const { id } = await context.params;
    const submission = await moderateSubmission(
      id,
      body.status,
      typeof body.reviewNote === "string" ? body.reviewNote : "",
    );
    return Response.json(
      { submission },
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
