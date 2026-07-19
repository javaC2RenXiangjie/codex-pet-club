import {
  listCreatorSubmissions,
  RegistryError,
  type SubmissionStatus,
} from "../../../../lib/pet-registry";
import {
  currentUser,
  userAuthErrorResponse,
} from "../../../../lib/user-auth";

export const dynamic = "force-dynamic";

const submissionStatuses = new Set<SubmissionStatus>([
  "pending",
  "published",
  "unpublished",
  "rejected",
]);

export async function GET(request: Request) {
  try {
    const user = await currentUser(request);
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status")?.trim() ?? "";
    if (rawStatus && !submissionStatuses.has(rawStatus as SubmissionStatus)) {
      return Response.json({ error: "投稿状态无效" }, { status: 400 });
    }
    const page = Number(url.searchParams.get("page") ?? "1");
    const pageSize = Number(url.searchParams.get("pageSize") ?? "12");
    return Response.json(
      await listCreatorSubmissions(user.id, {
        status: rawStatus ? rawStatus as SubmissionStatus : undefined,
        page,
        pageSize,
      }),
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof RegistryError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return userAuthErrorResponse(error);
  }
}
