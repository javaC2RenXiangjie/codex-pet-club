"use client";

import { useEffect, useRef, useState } from "react";
import {
  PetSpritePlayer,
  type PetActionRow,
} from "./pet-sprite-player";

export function ViewportPetSprite({
  name,
  row = 0,
  size = "card",
  src,
}: {
  name: string;
  row?: PetActionRow;
  size?: "card" | "admin" | "detail";
  src: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { rootMargin: "120px", threshold: 0.05 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      <PetSpritePlayer active={active} name={name} row={row} size={size} src={src} />
    </div>
  );
}
