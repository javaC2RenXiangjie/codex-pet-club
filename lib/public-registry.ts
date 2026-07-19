import {
  findPublicPet,
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
