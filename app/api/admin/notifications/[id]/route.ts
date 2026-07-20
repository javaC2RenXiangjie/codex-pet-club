import { adminOnlyResponse } from "../../../../../lib/admin-auth";
import { deliverReviewNotification } from "../../../../../lib/review-notifications";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const blocked = await adminOnlyResponse(request);
  if (blocked) return blocked;
  try {
    const { id } = await context.params;
    const notification = await deliverReviewNotification(id, { manual: true });
    if (!notification) {
      return Response.json({ error: "通知记录不存在" }, { status: 404 });
    }
    return Response.json(
      { notification },
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    console.error(error);
    return Response.json({ error: "通知重发失败，请稍后重试" }, { status: 500 });
  }
}
