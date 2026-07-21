"use client";

import Link from "next/link";
import { useState } from "react";
import {
  PET_ACTIONS,
  PetSpritePlayer,
  type PetActionRow,
} from "../../components/pet-sprite-player";
import { SiteFooter } from "../../components/site-footer";
import { PublicSiteHeader } from "../../components/public-site-header";

type PublicPet = {
  id: string;
  petKey: string;
  displayName: string;
  description: string;
  author: string;
  license: string;
  category: string;
  tags: string[];
  creatorId: string | null;
  version: string;
  sha256: string;
  sizeBytes: number;
  updatedAt: string;
  isOfficial: boolean;
};

const categoryLabels: Record<string, string> = {
  character: "人物角色",
  animal: "动物伙伴",
  fantasy: "奇幻生物",
  robot: "机器人",
  other: "其他",
};

export function PetDetailClient({ pet }: { pet: PublicPet }) {
  const [row, setRow] = useState<PetActionRow>(0);
  const [toast, setToast] = useState("");
  const currentAction = PET_ACTIONS.find((action) => action.row === row) ?? PET_ACTIONS[0];

  async function copyInstallCommand() {
    const command = `使用 $codex-pet-club，把这个桌宠下载到我本地，ID：${pet.id}`;
    try {
      await navigator.clipboard.writeText(command);
      setToast("安装指令已复制");
    } catch {
      setToast(`请复制桌宠 ID：${pet.id}`);
    }
    window.setTimeout(() => setToast(""), 2800);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast("详情链接已复制");
    } catch {
      setToast("请从地址栏复制当前链接");
    }
    window.setTimeout(() => setToast(""), 2800);
  }

  return (
    <main className="pet-detail-page">
      <PublicSiteHeader subtitle="桌宠独立详情" />

      <div className="pet-detail-breadcrumb">
        <Link href="/pets">← 返回桌宠库</Link>
        <span>独立详情 / {pet.id}</span>
        <button className="pet-share-link" onClick={copyLink}>复制详情链接 ↗</button>
      </div>

      <section className="pet-detail-modal pet-detail-modal--page" aria-labelledby="pet-detail-title">
        <div className="pet-detail-stage">
          <span className="pixel-dot pixel-dot--one" />
          <span className="pixel-dot pixel-dot--two" />
          <div className="pet-detail-player-wrap">
            <PetSpritePlayer
              name={pet.displayName}
              row={row}
              size="detail"
              src={`/api/pets/${pet.id}/preview`}
            />
            <span className="pet-shadow" />
          </div>
          <div className="pet-detail-now">
            <span>NOW PLAYING</span>
            <strong>{currentAction.label}</strong>
          </div>
          <div className="pet-detail-actions" aria-label="选择桌宠动作">
            {PET_ACTIONS.map((action) => (
              <button
                aria-pressed={row === action.row}
                className={row === action.row ? "active" : ""}
                key={action.id}
                onClick={() => setRow(action.row)}
              >
                <span>{String(action.row + 1).padStart(2, "0")}</span>
                {action.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pet-detail-content">
          <div className="pet-detail-heading">
            <div>
              <span className="section-kicker">CODEX V2 / PET DETAIL</span>
              <h1 id="pet-detail-title">{pet.displayName}</h1>
            </div>
            <span className="pet-detail-live">9 ACTIONS</span>
          </div>
          <p className="pet-detail-description">{pet.description}</p>
          <div className="pet-detail-taxonomy">
            <span>{categoryLabels[pet.category] ?? "其他"}</span>
            {pet.tags.map((tag) => <span key={tag}>#{tag}</span>)}
          </div>
          <dl className="pet-detail-metadata">
            <div>
              <dt>作者</dt>
              <dd>{pet.creatorId ? <Link href={`/creators/${pet.creatorId}`}>{pet.author || "Community"}</Link> : pet.author || "Community"}</dd>
            </div>
            <div><dt>许可证</dt><dd>{pet.license}</dd></div>
            <div><dt>桌宠标识</dt><dd>{pet.petKey}</dd></div>
            <div><dt>当前版本</dt><dd>v{pet.version}</dd></div>
            <div><dt>最近更新</dt><dd>{new Date(pet.updatedAt).toLocaleDateString("zh-CN")}</dd></div>
            <div><dt>文件校验</dt><dd>{pet.sha256.slice(0, 16)}…</dd></div>
          </dl>
          <button className="pet-detail-id" onClick={copyInstallCommand}>
            <span><small>UNIQUE PET ID</small><code>{pet.id}</code></span>
            <strong>复制指令</strong>
          </button>
          <div className="pet-detail-install">
            <div>
              <span>SKILL ONLY</span>
              <p>网页只负责发现与预览，桌宠文件仍只通过官方 Skill 安装。</p>
            </div>
            <button onClick={copyInstallCommand}>复制安装指令 ↗</button>
          </div>
        </div>
      </section>

      <SiteFooter />
      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </main>
  );
}
