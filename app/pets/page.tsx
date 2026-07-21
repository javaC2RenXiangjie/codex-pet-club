import type { Metadata } from "next";
import { PetCatalogClient } from "./pet-catalog-client";

export const metadata: Metadata = {
  title: "桌宠库 · Codex Pet Club",
  description: "浏览经过审核、可以通过官方 Skill 安装的 Codex v2 动画桌宠。",
  alternates: { canonical: "/pets" },
};

export default function PetsPage() {
  return <PetCatalogClient />;
}
