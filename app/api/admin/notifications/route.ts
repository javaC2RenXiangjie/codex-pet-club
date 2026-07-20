import { adminOnlyResponse } from "../../../../lib/admin-auth";
import {
  listReviewNotifications,
  type ReviewNotificationStatus,
} from "../../../../lib/review-notifications";

export const dynamic = "force-dynamic";

const statuses = new Set<ReviewNotificationStatus>([
  "pending",
  "sending",
  "sent",
  "failed",
]);

export async function GET(request: Request) {
  const blocked = await adminOnlyResponse(request);
  if (blocked) return blocked;
  try {
    const params = new URL(request.url).searchParams;
    const rawStatus = params.get("status")?.trim() ?? "";
    if (rawStatus && !statuses.has(rawStatus as ReviewNotificationStatus)) {
      return Response.json({ error: "通知状态无效" }, { status: 400 });
    }
    return Response.json(
      await listReviewNotifications({
        status: rawStatus ? rawStatus as ReviewNotificationStatus : undefined,
        page: Number(params.get("page") ?? "1"),
        pageSize: Number(params.get("pageSize") ?? "20"),
      }),
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    console.error(error);
    return Response.json({ error: "通知记录加载失败，请稍后重试" }, { status: 500 });
  }
}
