import { adminOnlyResponse } from "../../../../lib/admin-auth";
import { getRegistryHealth } from "../../../../lib/registry-health";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = await adminOnlyResponse(request);
  if (blocked) return blocked;
  try {
    return Response.json(await getRegistryHealth(), {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "服务状态检查失败，请稍后重试" },
      { status: 500 },
    );
  }
}
