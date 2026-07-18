"use client";

import { useEffect, useState, type CSSProperties } from "react";

export const PET_ACTIONS = [
  { row: 0, id: "idle", label: "待机" },
  { row: 1, id: "running-right", label: "向右移动" },
  { row: 2, id: "running-left", label: "向左移动" },
  { row: 3, id: "waving", label: "挥手" },
  { row: 4, id: "jumping", label: "跳跃" },
  { row: 5, id: "failed", label: "失败" },
  { row: 6, id: "waiting", label: "等待" },
  { row: 7, id: "running", label: "运行" },
  { row: 8, id: "review", label: "审核" },
] as const;

export type PetActionRow = (typeof PET_ACTIONS)[number]["row"];

export function PetSpritePlayer({
  src,
  name,
  row = 0,
  size = "card",
}: {
  src: string;
  name: string;
  row?: PetActionRow;
  size?: "card" | "admin" | "detail";
}) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setFrame((current) => (current + 1) % 8);
    }, 140);
    return () => window.clearInterval(timer);
  }, [row]);

  const action = PET_ACTIONS[row];
  const frameX = (frame / 7) * 100;
  const rowY = (row / 10) * 100;

  return (
    <div
      aria-label={`${name}：${action.label}动作，第 ${frame + 1} 帧`}
      className={`pet-sprite-player pet-sprite-player--${size}`}
      data-action={action.id}
      data-frame={frame}
      data-row={row}
      role="img"
      style={
        {
          backgroundImage: `url(${src})`,
          backgroundPosition: `${frameX}% ${rowY}%`,
        } as CSSProperties
      }
    />
  );
}
