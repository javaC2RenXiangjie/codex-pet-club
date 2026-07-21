"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { categoryLabels, type PublicPet } from "../components/public-pet";
import { PublicSiteHeader } from "../components/public-site-header";
import { SiteFooter } from "../components/site-footer";
import { ViewportPetSprite } from "../components/viewport-pet-sprite";

type CatalogResponse = {
  pets: PublicPet[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  categories: Array<{ id: string; label: string; count: number }>;
  tags: Array<{ name: string; count: number }>;
};

export function PetCatalogClient() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [catalog, setCatalog] = useState<CatalogResponse>({
    pets: [], page: 1, pageSize: 12, total: 0, totalPages: 1, categories: [], tags: [],
  });

  useEffect(() => {
    const controller = new AbortController();
    const search = new URLSearchParams({ page: String(page), pageSize: "12", sort });
    if (query.trim()) search.set("query", query.trim());
    if (category) search.set("category", category);
    if (tag) search.set("tag", tag);
    const timer = window.setTimeout(() => {
      setState("loading");
      fetch(`/api/pets?${search}`, { headers: { accept: "application/json" }, signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) throw new Error(`Catalog returned ${response.status}`);
          return response.json() as Promise<CatalogResponse>;
        })
        .then((data) => {
          setCatalog(data);
          setState("ready");
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setState("error");
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [category, page, query, sort, tag]);

  function clearFilters() {
    setQuery("");
    setCategory("");
    setTag("");
    setPage(1);
  }

  return (
    <main className="gallery-page">
      <PublicSiteHeader subtitle="真实桌宠作品画廊" />

      <section className="gallery-hero">
        <div>
          <span className="story-kicker">VERIFIED CODEX V2 PETS</span>
          <h1>去认识你的<br /><em>下一位搭档。</em></h1>
        </div>
        <p>这里的每一只桌宠都经过审核，拥有真实动作和唯一 ID，并且只通过官方 Skill 安装。</p>
      </section>

      <section className="gallery-controls" aria-label="桌宠筛选">
        <div className="gallery-search-row">
          <label className="gallery-search">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">搜索桌宠</span>
            <input
              onChange={(event) => { setQuery(event.target.value); setPage(1); }}
              placeholder="搜索名字、作者、标签或桌宠 ID"
              value={query}
            />
          </label>
          <label className="gallery-sort">
            <span>排序</span>
            <select onChange={(event) => { setSort(event.target.value); setPage(1); }} value={sort}>
              <option value="newest">最新发布</option>
              <option value="updated">最近更新</option>
              <option value="name">名称排序</option>
            </select>
          </label>
        </div>
        <div className="gallery-category-row">
          <button className={!category ? "active" : ""} onClick={() => { setCategory(""); setPage(1); }}>全部</button>
          {catalog.categories.filter((item) => item.count > 0).map((item) => (
            <button
              className={category === item.id ? "active" : ""}
              key={item.id}
              onClick={() => { setCategory(item.id); setPage(1); }}
            >{item.label}<span>{item.count}</span></button>
          ))}
          {catalog.tags.length > 0 && (
            <details className="gallery-more-filters">
              <summary>更多筛选{tag ? " · 1" : ""}</summary>
              <div>
                <button className={!tag ? "active" : ""} onClick={() => { setTag(""); setPage(1); }}>全部标签</button>
                {catalog.tags.map((item) => (
                  <button className={tag === item.name ? "active" : ""} key={item.name} onClick={() => { setTag(item.name); setPage(1); }}>
                    #{item.name} <span>{item.count}</span>
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
      </section>

      <section className="gallery-results" aria-live="polite">
        <div className="gallery-result-heading">
          <span>{state === "ready" ? `共 ${catalog.total} 只桌宠` : state === "loading" ? "正在寻找桌宠…" : "桌宠库暂时不可用"}</span>
          {(query || category || tag) && <button onClick={clearFilters}>清除筛选</button>}
        </div>

        {state === "ready" && catalog.pets.length > 0 ? (
          <div className="gallery-grid">
            {catalog.pets.map((pet, index) => (
              <Link className="gallery-card" href={`/pets/${pet.id}`} key={pet.id}>
                <div className={`gallery-card-preview gallery-card-preview--${index % 6}`}>
                  <ViewportPetSprite name={pet.displayName} src={`/api/pets/${pet.id}/preview`} />
                  <span className="gallery-card-number">{String((catalog.page - 1) * catalog.pageSize + index + 1).padStart(2, "0")}</span>
                  {pet.isOfficial && <span className="gallery-official">官方孵化</span>}
                </div>
                <div className="gallery-card-copy">
                  <div>
                    <span>{categoryLabels[pet.category] ?? "其他"}</span>
                    <small>{pet.author || "社区创作者"}</small>
                  </div>
                  <h2>{pet.displayName}</h2>
                  <p>{pet.description || "这只桌宠正在等待一句正式介绍。"}</p>
                  <div className="gallery-card-tags">
                    {pet.tags.slice(0, 2).map((petTag) => <span key={petTag}>#{petTag}</span>)}
                  </div>
                  <strong>查看九种动作与安装方式 ↗</strong>
                </div>
              </Link>
            ))}
          </div>
        ) : state !== "loading" ? (
          <div className="gallery-empty">
            <span>∅</span>
            <h2>{state === "error" ? "暂时没能连接到桌宠库" : "没有找到符合条件的桌宠"}</h2>
            <p>{state === "error" ? "稍后刷新页面重试。" : "换一个名字、分类或标签再看看。"}</p>
            {(query || category || tag) && <button onClick={clearFilters}>清空筛选</button>}
          </div>
        ) : (
          <div className="gallery-loading"><i /><i /><i /></div>
        )}

        {state === "ready" && catalog.totalPages > 1 && (
          <nav className="gallery-pagination" aria-label="桌宠库分页">
            <button disabled={catalog.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>← 上一页</button>
            <span>第 {catalog.page} / {catalog.totalPages} 页</span>
            <button disabled={catalog.page >= catalog.totalPages} onClick={() => setPage((value) => Math.min(catalog.totalPages, value + 1))}>下一页 →</button>
          </nav>
        )}
      </section>

      <section className="gallery-publish">
        <div><span>CREATED BY THE COMMUNITY</span><h2>也想让你的桌宠出现在这里？</h2></div>
        <Link className="button button--dark" href="/skill#publish">查看投稿方式 ↗</Link>
      </section>
      <SiteFooter note="浏览留给作品画廊，安装交给官方 Skill。" />
    </main>
  );
}
