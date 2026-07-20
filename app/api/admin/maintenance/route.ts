import { adminOnlyResponse } from "../../../../lib/admin-auth";
import { runDailyMaintenance } from "../../../../lib/maintenance";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = await adminOnlyResponse(request);
  if (blocked) return blocked;
  try {
    return Response.json(await runDailyMaintenance(), {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "每日维护执行失败，请查看维护状态后重试" },
      { status: 500, headers: { "cache-control": "private, no-store" } },
    );
  }
}
