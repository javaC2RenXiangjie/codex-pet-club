"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  PET_ACTIONS,
  PetSpritePlayer,
  type PetActionRow,
} from "./components/pet-sprite-player";
import { SiteFooter } from "./components/site-footer";

type RegistryPet = {
  id: string;
  petKey: string;
  displayName: string;
  description: string;
  author: string;
  license: string;
  category: string;
  tags: string[];
  version: string;
  sha256: string;
  sizeBytes: number;
  updatedAt: string;
};

type CatalogResponse = {
  pets: RegistryPet[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  categories: Array<{ id: string; label: string; count: number }>;
  tags: Array<{ name: string; count: number }>;
};

const categoryLabels: Record<string, string> = {
  character: "人物角色",
  animal: "动物伙伴",
  fantasy: "奇幻生物",
  robot: "机器人",
  other: "其他",
};

const registryPalettes = [
  ["#f5a15b", "#ffe0ae"],
  ["#171a26", "#a5f4d1"],
  ["#5f73c9", "#d9ddff"],
  ["#9dd5cb", "#e4fff8"],
  ["#b79be6", "#f0e5ff"],
  ["#ef6f5d", "#ffd7bd"],
] as const;

function RegistryPetPreview({ pet, index }: { pet: RegistryPet; index: number }) {
  const [color, accent] = registryPalettes[index % registryPalettes.length];
  return (
    <div
      className="pet-preview pet-preview--registry"
      style={{ "--pet-color": color, "--pet-accent": accent } as React.CSSProperties}
    >
      <span className="pixel-dot pixel-dot--one" />
      <span className="pixel-dot pixel-dot--two" />
      <PetSpritePlayer
        name={pet.displayName}
        src={`/api/pets/${pet.id}/preview`}
      />
      <span className="pet-shadow" />
      <span className="pet-status">LIVE IDLE</span>
    </div>
  );
}

function RegistryPetDetail({
  pet,
  index,
  onClose,
  onCopy,
}: {
  pet: RegistryPet;
  index: number;
  onClose: () => void;
  onCopy: (pet: RegistryPet) => void;
}) {
  const [row, setRow] = useState<PetActionRow>(0);
  const [color, accent] = registryPalettes[index % registryPalettes.length];
  const currentAction = PET_ACTIONS.find((action) => action.row === row) ?? PET_ACTIONS[0];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="pet-detail-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="pet-detail-title"
        aria-modal="true"
        className="pet-detail-modal"
        data-testid="pet-detail-modal"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button className="pet-detail-close" aria-label="关闭桌宠详情" onClick={onClose}>×</button>

        <div
          className="pet-detail-stage"
          style={{ "--pet-color": color, "--pet-accent": accent } as React.CSSProperties}
        >
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
                data-testid={`detail-motion-${pet.id}-${action.id}`}
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
              <h2 id="pet-detail-title">{pet.displayName}</h2>
            </div>
            <span className="pet-detail-live">9 ACTIONS</span>
          </div>
          <p className="pet-detail-description">{pet.description}</p>

          <div className="pet-detail-taxonomy">
            <span>{categoryLabels[pet.category] ?? "其他"}</span>
            {pet.tags.map((tag) => <span key={tag}>#{tag}</span>)}
          </div>

          <dl className="pet-detail-metadata">
            <div><dt>作者</dt><dd>{pet.author || "Community"}</dd></div>
            <div><dt>许可证</dt><dd>{pet.license}</dd></div>
            <div><dt>桌宠标识</dt><dd>{pet.petKey}</dd></div>
            <div><dt>当前版本</dt><dd>v{pet.version}</dd></div>
            <div><dt>文件校验</dt><dd>{pet.sha256.slice(0, 16)}…</dd></div>
          </dl>

          <button
            aria-label={`复制 ${pet.displayName} 的桌宠 ID`}
            className="pet-detail-id"
            onClick={() => onCopy(pet)}
          >
            <span>
              <small>UNIQUE PET ID</small>
              <code>{pet.id}</code>
            </span>
            <strong>复制 ID</strong>
          </button>

          <div className="pet-detail-install">
            <div>
              <span>SKILL ONLY</span>
              <p>安装仍只通过官方 Skill 完成，网页不提供桌宠文件直链。</p>
            </div>
            <div className="pet-detail-buttons">
              <Link href={`/pets/${pet.id}`}>独立详情页</Link>
              <button onClick={() => onCopy(pet)}>复制安装指令 ↗</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const [registryPets, setRegistryPets] = useState<RegistryPet[]>([]);
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [catalog, setCatalog] = useState<CatalogResponse>({
    pets: [], page: 1, pageSize: 12, total: 0, totalPages: 1, categories: [], tags: [],
  });
  const [selectedPet, setSelectedPet] = useState<RegistryPet | null>(null);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    const search = new URLSearchParams({ page: String(page), pageSize: "12", sort });
    if (query.trim()) search.set("query", query.trim());
    if (category) search.set("category", category);
    if (tag) search.set("tag", tag);
    const timer = window.setTimeout(() => fetch(`/api/pets?${search}`, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Registry returned ${response.status}`);
        return response.json() as Promise<CatalogResponse>;
      })
      .then((data) => {
        setRegistryPets(Array.isArray(data.pets) ? data.pets : []);
        setCatalog(data);
        setCatalogState("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCatalogState("error");
      }), 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, category, tag, sort, page]);

  const featuredPet = registryPets[0] ?? null;

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function copyPetCommand(pet: RegistryPet) {
    const command = `使用 $codex-pet-club，把这个桌宠下载到我本地，ID：${pet.id}`;
    try {
      await navigator.clipboard.writeText(command);
      flash(`${pet.displayName} 的安装指令已复制`);
    } catch {
      flash(`请复制桌宠 ID：${pet.id}`);
    }
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Codex Pet Club 首页">
          <span className="brand-mark">C:</span>
          <span>
            <strong>Codex Pet Club</strong>
            <small>桌宠开源俱乐部</small>
          </span>
        </a>
        <nav aria-label="主导航">
          <a href="#catalog">桌宠库</a>
          <Link href="/skill">安装 Skill</Link>
          <Link href="/account">创作者账户</Link>
          <Link className="nav-submit" href="/skill#publish">分享我的桌宠 ↗</Link>
        </nav>
      </header>

      <section className="market-hero" id="top">
        <div className="market-hero-copy">
          <div className="eyebrow"><span>CODEX PET MARKET</span> · VERIFIED V2 PETS</div>
          <h1>给你的 Codex，<br /><em>换一位新搭档。</em></h1>
          <p>
            浏览社区发布的真实桌宠，点击查看全部动作。选中喜欢的以后，
            复制唯一 ID，剩下的安装和校验交给 Codex。
          </p>
          <div className="market-hero-actions">
            <a className="button button--primary" href="#catalog">
              浏览桌宠库 <span aria-hidden="true">↓</span>
            </a>
            <Link className="text-link" href="/skill">
              如何安装 Skill <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className="market-stats" aria-label="桌宠库数据">
            <span><strong>{String(catalog.total).padStart(2, "0")}</strong> 当前结果</span>
            <span><strong>09</strong> 标准动作</span>
            <span><strong>SKILL</strong> 安装通道</span>
          </div>
        </div>

        <div className="featured-panel" aria-label="本期推荐桌宠">
          <div className="featured-panel-header">
            <span>FEATURED PET</span>
            <small>真实已发布桌宠</small>
          </div>
          {featuredPet ? (
            <button
              aria-label={`查看推荐桌宠 ${featuredPet.displayName} 的详情`}
              className="featured-pet"
              onClick={() => setSelectedPet(featuredPet)}
            >
              <RegistryPetPreview pet={featuredPet} index={0} />
              <div className="featured-pet-copy">
                <span>CODEX V2 · 9 ACTIONS</span>
                <h2>{featuredPet.displayName}</h2>
                <p>{featuredPet.description}</p>
                <strong>查看完整动作与安装 ID ↗</strong>
              </div>
            </button>
          ) : (
            <div className="featured-loading">
              <span>···</span>
              <p>{catalogState === "error" ? "桌宠库暂时不可用" : "正在载入本期推荐"}</p>
            </div>
          )}
        </div>
      </section>

      <section className="catalog-section" id="catalog">
        <div className="section-heading">
          <div>
            <span className="section-kicker">VERIFIED PET LIBRARY</span>
            <h2>桌宠库</h2>
          </div>
          <p>这里只展示通过审核的 Codex v2 桌宠。点击任意桌宠，查看全部动作和唯一安装 ID。</p>
        </div>

        <div className="catalog-toolbar">
          <div className="filters" role="group" aria-label="按风格筛选">
            <button
              className={category === "" ? "active" : ""}
              aria-pressed={category === ""}
              onClick={() => { setCategory(""); setPage(1); }}
            >全部 <span>{catalog.categories.reduce((sum, item) => sum + item.count, 0)}</span></button>
            {catalog.categories.filter((item) => item.count > 0).map((item) => (
              <button
                className={category === item.id ? "active" : ""}
                aria-pressed={category === item.id}
                key={item.id}
                onClick={() => { setCategory(item.id); setPage(1); }}
              >{item.label} <span>{item.count}</span></button>
            ))}
          </div>
          <div className="catalog-search-sort">
            <label className="search-box">
              <span aria-hidden="true">⌕</span>
              <span className="sr-only">搜索桌宠</span>
              <input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                placeholder="搜索名字、标签、作者或桌宠 ID"
              />
              <kbd>⌘ K</kbd>
            </label>
            <label className="catalog-sort">
              <span className="sr-only">排序方式</span>
              <select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
                <option value="newest">最新发布</option>
                <option value="updated">最近更新</option>
                <option value="name">名称排序</option>
              </select>
            </label>
          </div>
        </div>

        {catalog.tags.length > 0 && (
          <div className="catalog-tags" aria-label="按标签筛选">
            <button className={!tag ? "active" : ""} onClick={() => { setTag(""); setPage(1); }}>全部标签</button>
            {catalog.tags.map((item) => (
              <button
                className={tag === item.name ? "active" : ""}
                key={item.name}
                onClick={() => { setTag(tag === item.name ? "" : item.name); setPage(1); }}
              >#{item.name} <span>{item.count}</span></button>
            ))}
          </div>
        )}

        <div className="catalog-notice">
          <span>SKILL ONLY</span>
          点击桌宠卡片查看完整详情与全部 9 种动作，再复制唯一 ID 交给 Codex 安装。
        </div>

        <div className="catalog-result-line">
          <span>共 {catalog.total} 只桌宠</span>
          {(query || category || tag) && <button onClick={() => { setQuery(""); setCategory(""); setTag(""); setPage(1); }}>清除筛选</button>}
        </div>

        {catalogState === "ready" && registryPets.length > 0 ? (
          <div className="pet-grid">
            {registryPets.map((pet, index) => (
              <article className="pet-list-item" key={pet.id}>
                <button
                  aria-label={`查看 ${pet.displayName} 的桌宠详情`}
                  className="pet-list-card"
                  data-testid={`open-pet-${pet.id}`}
                  onClick={() => setSelectedPet(pet)}
                >
                  <div className="card-number">{String(index + 1).padStart(2, "0")}</div>
                  <RegistryPetPreview pet={pet} index={index} />
                  <div className="pet-list-content">
                    <div className="pet-meta">
                      <span className="category-pill">{categoryLabels[pet.category] ?? "其他"}</span>
                      <span className="download-count">9 ACTIONS</span>
                    </div>
                    <h3>{pet.displayName}</h3>
                    <p>{pet.description}</p>
                    <div className="tag-row">
                      {pet.tags.slice(0, 4).map((petTag) => <span key={petTag}>#{petTag}</span>)}
                      {pet.tags.length === 0 && <span>{pet.license}</span>}
                    </div>
                    <div className="pet-list-footer">
                      <span>by {pet.author || "Community"}</span>
                      <strong>查看详情与全部动作 ↗</strong>
                    </div>
                  </div>
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span>{catalogState === "loading" ? "…" : "∅"}</span>
            <h3>{catalogState === "loading" ? "正在连接桌宠库" : catalogState === "error" ? "桌宠库暂时不可用" : query ? "没有匹配的桌宠" : "首批桌宠正在审核上架"}</h3>
            <p>{catalogState === "ready" ? "只有验证通过、确实能装进 Codex 的桌宠才会出现在这里。" : "稍后刷新页面重试。"}</p>
            {(query || category || tag) && <button onClick={() => { setQuery(""); setCategory(""); setTag(""); setPage(1); }}>清空筛选</button>}
          </div>
        )}

        {catalogState === "ready" && catalog.totalPages > 1 && (
          <nav className="catalog-pagination" aria-label="桌宠库分页">
            <button disabled={catalog.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← 上一页</button>
            <span>第 {catalog.page} / {catalog.totalPages} 页</span>
            <button disabled={catalog.page >= catalog.totalPages} onClick={() => setPage((value) => Math.min(catalog.totalPages, value + 1))}>下一页 →</button>
          </nav>
        )}
      </section>

      <section className="publish-strip">
        <div>
          <span className="section-kicker">PUBLISH YOUR PET</span>
          <h2>也想把自己的桌宠放进来？</h2>
          <p>让官方 Skill 校验并上传本地桌宠。投稿进入审核队列，通过后才会出现在公开桌宠库。</p>
        </div>
        <Link className="button button--dark" href="/skill#publish">查看投稿方式 ↗</Link>
      </section>

      <SiteFooter />

      {selectedPet && (
        <RegistryPetDetail
          index={Math.max(0, registryPets.findIndex((pet) => pet.id === selectedPet.id))}
          onClose={() => setSelectedPet(null)}
          onCopy={copyPetCommand}
          pet={selectedPet}
        />
      )}

      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </main>
  );
}
