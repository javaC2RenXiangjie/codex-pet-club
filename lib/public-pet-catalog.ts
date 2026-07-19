export type PublicPet = {
  id: string;
  petKey: string;
  displayName: string;
  description: string;
  author: string;
  license: string;
  sha256: string;
  sizeBytes: number;
  updatedAt: string;
};

export type PublicPetAsset = PublicPet & {
  packageKey: string;
  previewPath: string;
};

const catalog: PublicPetAsset[] = [
  {
    id: "063e4124-91e3-440d-9f3b-40034565a54f",
    petKey: "fengxi-3d",
    displayName: "凤喜 3D",
    description: "一位穿黑金双凤中式礼服、捧着玫瑰、笑容灿烂的 3D Q版新郎官桌宠。",
    author: "Community",
    license: "unspecified",
    sha256: "8ce62b254f873e1b7c7969b5cbde36340e52a54796406af0ec27c3090059944b",
    sizeBytes: 1734934,
    updatedAt: "2026-07-18T09:58:06.730Z",
    packageKey: "packages/fengxi-3d.zip",
    previewPath: "/registry/previews/063e4124-91e3-440d-9f3b-40034565a54f.webp",
  },
  {
    id: "e9029e8c-de60-4f0b-bf79-81156c978126",
    petKey: "fengxi",
    displayName: "凤喜",
    description: "一位穿黑金双凤中式礼服、捧着红玫瑰、笑容灿烂的新郎官桌宠。",
    author: "Community",
    license: "unspecified",
    sha256: "99f2aa0000b3577c813259afe98716309dbcf597a7096bdaa59b0266b066e810",
    sizeBytes: 1905027,
    updatedAt: "2026-07-18T08:17:05.654Z",
    packageKey: "packages/fengxi.zip",
    previewPath: "/registry/previews/e9029e8c-de60-4f0b-bf79-81156c978126.webp",
  },
];

export function toPublicPet(pet: PublicPetAsset): PublicPet {
  return {
    id: pet.id,
    petKey: pet.petKey,
    displayName: pet.displayName,
    description: pet.description,
    author: pet.author,
    license: pet.license,
    sha256: pet.sha256,
    sizeBytes: pet.sizeBytes,
    updatedAt: pet.updatedAt,
  };
}

export const publicPets: PublicPet[] = catalog.map(toPublicPet);

export function findPublicPet(id: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{7,63}$/.test(id)) return null;
  return catalog.find((pet) => pet.id === id) ?? null;
}
