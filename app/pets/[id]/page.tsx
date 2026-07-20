import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { publicMetadata, resolvePublicPet } from "../../../lib/public-registry";
import { PetDetailClient } from "./pet-detail-client";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

async function findPet(id: string) {
  const resolved = await resolvePublicPet(id);
  return resolved ? publicMetadata(resolved) : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const pet = await findPet((await params).id);
  if (!pet) return { title: "桌宠未找到 · Codex Pet Club" };
  return {
    title: `${pet.displayName} · Codex Pet Club`,
    description: pet.description,
    alternates: { canonical: `/pets/${pet.id}` },
    openGraph: {
      title: `${pet.displayName} · Codex Pet Club`,
      description: pet.description,
      type: "website",
      images: [{ url: "/og.png", width: 1200, height: 630 }],
    },
  };
}

export default async function PetPage({ params }: PageProps) {
  const pet = await findPet((await params).id);
  if (!pet) notFound();
  return <PetDetailClient pet={pet} />;
}
