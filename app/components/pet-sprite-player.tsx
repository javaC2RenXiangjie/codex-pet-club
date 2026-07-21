"use client";

import { useEffect, useState, type CSSProperties } from "react";

export const PET_ACTIONS = [
  { row: 0, id: "idle", label: "待机", frameDurations: [280, 110, 110, 140, 140, 320] },
  { row: 1, id: "running-right", label: "向右移动", frameDurations: [120, 120, 120, 120, 120, 120, 120, 220] },
  { row: 2, id: "running-left", label: "向左移动", frameDurations: [120, 120, 120, 120, 120, 120, 120, 220] },
  { row: 3, id: "waving", label: "挥手", frameDurations: [140, 140, 140, 280] },
  { row: 4, id: "jumping", label: "跳跃", frameDurations: [140, 140, 140, 140, 280] },
  { row: 5, id: "failed", label: "失败", frameDurations: [140, 140, 140, 140, 140, 140, 140, 240] },
  { row: 6, id: "waiting", label: "等待", frameDurations: [150, 150, 150, 150, 150, 260] },
  { row: 7, id: "running", label: "运行", frameDurations: [120, 120, 120, 120, 120, 220] },
  { row: 8, id: "review", label: "审核", frameDurations: [150, 150, 150, 150, 150, 280] },
] as const;

export type PetActionRow = (typeof PET_ACTIONS)[number]["row"];

export function PetSpritePlayer({
  src,
  name,
  row = 0,
  size = "card",
  active = true,
}: {
  src: string;
  name: string;
  row?: PetActionRow;
  size?: "card" | "admin" | "detail";
  active?: boolean;
}) {
  const animationKey = `${active}:${row}`;
  const [animation, setAnimation] = useState({ key: animationKey, frame: 0 });
  const action = PET_ACTIONS[row];
  const frame = animation.key === animationKey ? animation.frame : 0;

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      setAnimation((current) => ({
        key: animationKey,
        frame: current.key === animationKey
          ? (current.frame + 1) % action.frameDurations.length
          : 1 % action.frameDurations.length,
      }));
    }, action.frameDurations[frame] ?? 140);
    return () => window.clearTimeout(timer);
  }, [action.frameDurations, active, animationKey, frame]);

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
