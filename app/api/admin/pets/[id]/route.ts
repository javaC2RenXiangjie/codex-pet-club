import {
  moderateSubmission,
  RegistryError,
  unpublishSubmission,
} from "../../../../../lib/pet-registry";
import { adminOnlyResponse } from "../../../../../lib/admin-auth";
import { deliverLatestReviewNotification } from "../../../../../lib/review-notifications";

export const dynamic = "force-dynamic";

const approvalChecklistKeys = ["animation", "content", "rights", "metadata"] as const;

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
      checklist?: unknown;
    };
    if (
      body.status !== "published" &&
      body.status !== "rejected" &&
      body.status !== "unpublished"
    ) {
      throw new RegistryError("status must be published, rejected, or unpublished");
    }
    const { id } = await context.params;
    const reviewNote = typeof body.reviewNote === "string" ? body.reviewNote : "";
    if (body.status === "published") {
      const checklist = body.checklist && typeof body.checklist === "object"
        ? body.checklist as Record<string, unknown>
        : {};
      if (!approvalChecklistKeys.every((key) => checklist[key] === true)) {
        throw new RegistryError("Complete every approval checklist item before publishing");
      }
    } else if (!reviewNote.trim()) {
      throw new RegistryError("A review reason is required when rejecting or unpublishing");
    }
    const submission =
      body.status === "unpublished"
        ? await unpublishSubmission(id, reviewNote)
        : await moderateSubmission(id, body.status, reviewNote);
    let notification = null;
    try {
      notification = await deliverLatestReviewNotification(id, body.status);
    } catch (error) {
      console.error("Review completed but notification delivery could not start", error);
    }
    return Response.json(
      { submission, notification },
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
