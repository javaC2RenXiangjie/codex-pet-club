import {
  listModerationSubmissions,
  queryModerationEvents,
  RegistryError,
  type SubmissionStatus,
} from "../../../../lib/pet-registry";
import { listRegistryBackups } from "../../../../lib/registry-backup";
import { adminOnlyResponse } from "../../../../lib/admin-auth";
import { listReviewNotifications } from "../../../../lib/review-notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = await adminOnlyResponse(request);
  if (blocked) return blocked;
  try {
    const url = new URL(request.url);
    const rawStatus = url.searchParams.get("status")?.trim() ?? "";
    const statuses = new Set<SubmissionStatus>([
      "pending",
      "published",
      "unpublished",
      "rejected",
    ]);
    if (rawStatus && !statuses.has(rawStatus as SubmissionStatus)) {
      throw new RegistryError("status must be pending, published, unpublished, or rejected");
    }
    const submissionPagePromise = listModerationSubmissions({
      status: rawStatus ? rawStatus as SubmissionStatus : undefined,
      query: url.searchParams.get("query") ?? "",
      duplicatesOnly: ["1", "true"].includes(url.searchParams.get("duplicates") ?? ""),
      page: Number(url.searchParams.get("page") ?? 1),
      pageSize: Number(url.searchParams.get("pageSize") ?? 20),
    });
    const [submissionPage, eventPage, notificationPage] = await Promise.all([
      submissionPagePromise,
      queryModerationEvents(),
      listReviewNotifications(),
    ]);
    let backups: Awaited<ReturnType<typeof listRegistryBackups>> = [];
    try {
      backups = await listRegistryBackups();
    } catch (error) {
      console.error("Registry backup list unavailable", error);
    }
    return Response.json(
      {
        submissions: submissionPage.submissions,
        submissionPage,
        events: eventPage.events,
        eventPage,
        notifications: notificationPage.notifications,
        notificationPage,
        backups,
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof RegistryError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "Unexpected registry error" }, { status: 500 });
  }
}
