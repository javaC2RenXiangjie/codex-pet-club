import { headers } from "next/headers";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host")?.split(":")[0].toLowerCase();
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]") {
    notFound();
  }
  return children;
}
