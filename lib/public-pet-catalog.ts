import catalogData from "../registry/catalog.json";

export type PetStatus = "published" | "unpublished";

export const petCategories = [
  { id: "character", label: "人物角色" },
  { id: "animal", label: "动物伙伴" },
  { id: "fantasy", label: "奇幻生物" },
  { id: "robot", label: "机器人" },
  { id: "other", label: "其他" },
] as const;

export type PetCategory = (typeof petCategories)[number]["id"];

export type PetRelease = {
  version: string;
  sha256: string;
  sizeBytes: number;
  publishedAt: string;
  packageKey: string;
  previewPath: string;
};

export type CatalogPet = {
  id: string;
  petKey: string;
  displayName: string;
  description: string;
  author: string;
  license: string;
  category: PetCategory;
  tags: string[];
  status: PetStatus;
  activeVersion: string;
  releases: PetRelease[];
  statusHistory: Array<{
    status: PetStatus;
    at: string;
    reason: string;
  }>;
};

export type PublicPet = {
  id: string;
  petKey: string;
  displayName: string;
  description: string;
  author: string;
  license: string;
  category: PetCategory;
  tags: string[];
  creatorId: string | null;
  version: string;
  sha256: string;
  sizeBytes: number;
  updatedAt: string;
};

export type PublicPetAsset = PublicPet & {
  packageKey: string;
  previewPath: string;
};

const catalog = catalogData as { schemaVersion: number; pets: CatalogPet[] };

const categoryIds = new Set<string>(petCategories.map((category) => category.id));

export function normalizePetCategory(value: unknown): PetCategory {
  return typeof value === "string" && categoryIds.has(value)
    ? value as PetCategory
    : "other";
}

export function normalizePetTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const tags = value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim().replace(/^#/, "").slice(0, 24))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, 8);
}

function resolvePublishedPet(pet: CatalogPet): PublicPetAsset | null {
  if (pet.status !== "published") return null;
  const release = pet.releases.find((candidate) => candidate.version === pet.activeVersion);
  if (!release) return null;
  return {
    id: pet.id,
    petKey: pet.petKey,
    displayName: pet.displayName,
    description: pet.description,
    author: pet.author,
    license: pet.license,
    category: normalizePetCategory(pet.category),
    tags: normalizePetTags(pet.tags),
    creatorId: null,
    version: release.version,
    sha256: release.sha256,
    sizeBytes: release.sizeBytes,
    updatedAt: release.publishedAt,
    packageKey: release.packageKey,
    previewPath: release.previewPath,
  };
}

export function toPublicPet(pet: PublicPetAsset): PublicPet {
  return {
    id: pet.id,
    petKey: pet.petKey,
    displayName: pet.displayName,
    description: pet.description,
    author: pet.author,
    license: pet.license,
    category: pet.category,
    tags: pet.tags,
    creatorId: pet.creatorId,
    version: pet.version,
    sha256: pet.sha256,
    sizeBytes: pet.sizeBytes,
    updatedAt: pet.updatedAt,
  };
}

export const publicPets: PublicPet[] = catalog.pets
  .map(resolvePublishedPet)
  .filter((pet): pet is PublicPetAsset => pet !== null)
  .map(toPublicPet);

export function findPublicPet(id: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,63}$/.test(id)) return null;
  const pet = catalog.pets.find((candidate) => candidate.id === id);
  return pet ? resolvePublishedPet(pet) : null;
}

export function findPublicPetByKey(petKey: string) {
  const pet = catalog.pets.find((candidate) => candidate.petKey === petKey);
  return pet ? resolvePublishedPet(pet) : null;
}
