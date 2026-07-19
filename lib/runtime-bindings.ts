import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export type PetRegistryBindings = {
  DB?: D1Database;
  PET_FILES?: R2Bucket;
};

const bindingKey = Symbol.for("codex-pet-club.runtime-bindings");

type RuntimeGlobal = typeof globalThis & {
  [bindingKey]?: PetRegistryBindings;
};

export function setPetRegistryBindings(bindings: PetRegistryBindings) {
  (globalThis as RuntimeGlobal)[bindingKey] = bindings;
}

export function getPetRegistryBindings() {
  return (globalThis as RuntimeGlobal)[bindingKey];
}
