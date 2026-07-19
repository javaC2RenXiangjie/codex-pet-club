import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

export type PetRegistryBindings = {
  DB?: D1Database;
  PET_FILES?: R2Bucket;
  ADMIN_TOKEN?: string;
  AUTH_SECRET?: string;
  SENDGRID_API_KEY?: string;
  EMAIL_FROM?: string;
  ASSETS?: {
    fetch(request: Request): Promise<Response>;
  };
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
