import { adminOnlyResponse } from "../../../../lib/admin-auth";
import {
  queryModerationEvents,
  RegistryError,
  type ModerationAction,
} from "../../../../lib/pet-registry";

export const dynamic = "force-dynamic";

const actions = new Set<ModerationAction>([
  "submitted",
  "published",
  "unpublished",
  "rejected",
]);

export async function GET(request: Request) {
  const blocked = await adminOnlyResponse(request);
  if (blocked) return blocked;
  try {
    const params = new URL(request.url).searchParams;
    const rawAction = params.get("action")?.trim() ?? "";
    if (rawAction && !actions.has(rawAction as ModerationAction)) {
      return Response.json({ error: "操作类型无效" }, { status: 400 });
    }
    const page = Number(params.get("page") ?? "1");
    const pageSize = Number(params.get("pageSize") ?? "6");
    return Response.json(
      await queryModerationEvents({
        action: rawAction ? (rawAction as ModerationAction) : undefined,
        query: params.get("query") ?? "",
        page,
        pageSize,
      }),
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    if (error instanceof RegistryError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(error);
    return Response.json({ error: "操作日志加载失败，请稍后重试" }, { status: 500 });
  }
}
