import {
  findPublicPet,
  petCategories,
  publicPets as officialPets,
  toPublicPet,
  type PublicPet,
  type PublicPetAsset,
} from "./public-pet-catalog";
import {
  getPublishedPet,
  listPublishedPets,
  RegistryError,
  type PublicPet as CommunityPet,
} from "./pet-registry";
import { getPetRegistryBindings } from "./runtime-bindings";

export type ResolvedPublicPet =
  | { source: "official"; pet: PublicPetAsset }
  | { source: "community"; pet: CommunityPet };

export type PublicCatalogSort = "newest" | "updated" | "name";

export type PublicCatalogPage = {
  pets: PublicPet[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  query: string;
  category: string;
  tag: string;
  sort: PublicCatalogSort;
  categories: Array<{ id: string; label: string; count: number }>;
  tags: Array<{ name: string; count: number }>;
};

function communityStorageAvailable() {
  const bindings = getPetRegistryBindings();
  return Boolean(bindings?.DB && bindings.PET_FILES);
}

export async function listAllPublicPets(): Promise<PublicPet[]> {
  if (!communityStorageAvailable()) return officialPets;

  const communityPets = await listPublishedPets();
  const officialIds = new Set(officialPets.map((pet) => pet.id));
  const officialKeys = new Set(officialPets.map((pet) => pet.petKey));
  return [
    ...officialPets,
    ...communityPets.filter(
      (pet) => !officialIds.has(pet.id) && !officialKeys.has(pet.petKey),
    ),
  ];
}

function safeSort(value: string | null | undefined): PublicCatalogSort {
  return value === "name" || value === "updated" ? value : "newest";
}

export async function listPublicPetCatalog({
  query = "",
  category = "",
  tag = "",
  sort = "newest",
  page = 1,
  pageSize = 12,
}: {
  query?: string;
  category?: string;
  tag?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
} = {}): Promise<PublicCatalogPage> {
  const allPets = await listAllPublicPets();
  const safeQuery = query.trim().slice(0, 80);
  const safeCategory = petCategories.some((candidate) => candidate.id === category)
    ? category
    : "";
  const safeTag = tag.trim().slice(0, 24);
  const safePageSize = Math.min(48, Math.max(1, Math.trunc(pageSize) || 12));
  const normalizedQuery = safeQuery.toLocaleLowerCase("zh-CN");
  const normalizedTag = safeTag.toLocaleLowerCase("zh-CN");
  const filtered = allPets.filter((pet) => {
    if (safeCategory && pet.category !== safeCategory) return false;
    if (
      normalizedTag
      && !pet.tags.some((candidate) => candidate.toLocaleLowerCase("zh-CN") === normalizedTag)
    ) return false;
    if (!normalizedQuery) return true;
    return [
      pet.id,
      pet.petKey,
      pet.displayName,
      pet.description,
      pet.author,
      pet.license,
      pet.category,
      ...pet.tags,
    ].join(" ").toLocaleLowerCase("zh-CN").includes(normalizedQuery);
  });
  const safeOrder = safeSort(sort);
  const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
  filtered.sort((left, right) => {
    if (safeOrder === "name") return collator.compare(left.displayName, right.displayName);
    if (safeOrder === "updated") return right.updatedAt.localeCompare(left.updatedAt);
    return right.updatedAt.localeCompare(left.updatedAt) || collator.compare(left.displayName, right.displayName);
  });
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(totalPages, Math.max(1, Math.trunc(page) || 1));
  const categoryCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  for (const pet of allPets) {
    categoryCounts.set(pet.category, (categoryCounts.get(pet.category) ?? 0) + 1);
    for (const petTag of pet.tags) tagCounts.set(petTag, (tagCounts.get(petTag) ?? 0) + 1);
  }
  return {
    pets: filtered.slice((safePage - 1) * safePageSize, safePage * safePageSize),
    page: safePage,
    pageSize: safePageSize,
    total,
    totalPages,
    query: safeQuery,
    category: safeCategory,
    tag: safeTag,
    sort: safeOrder,
    categories: petCategories.map((candidate) => ({
      ...candidate,
      count: categoryCounts.get(candidate.id) ?? 0,
    })),
    tags: [...tagCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((left, right) => right.count - left.count || collator.compare(left.name, right.name))
      .slice(0, 20),
  };
}

export async function resolvePublicPet(id: string): Promise<ResolvedPublicPet | null> {
  const official = findPublicPet(id);
  if (official) return { source: "official", pet: official };
  if (!communityStorageAvailable()) return null;

  try {
    return { source: "community", pet: await getPublishedPet(id) };
  } catch (error) {
    if (error instanceof RegistryError && error.status === 404) return null;
    throw error;
  }
}

export function publicMetadata(resolved: ResolvedPublicPet) {
  return resolved.source === "official" ? toPublicPet(resolved.pet) : resolved.pet;
}
