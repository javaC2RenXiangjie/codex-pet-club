import {
  listModerationSubmissions,
  queryModerationEvents,
  RegistryError,
} from "../../../../lib/pet-registry";
import { listRegistryBackups } from "../../../../lib/registry-backup";
import { adminOnlyResponse } from "../../../../lib/admin-auth";
import { listReviewNotifications } from "../../../../lib/review-notifications";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = await adminOnlyResponse(request);
  if (blocked) return blocked;
  try {
    const [submissions, eventPage, notificationPage] = await Promise.all([
      listModerationSubmissions(),
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
        submissions,
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
