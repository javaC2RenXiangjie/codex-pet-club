import catalogData from "../registry/catalog.json";

export type PetStatus = "published" | "unpublished";

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
