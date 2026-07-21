"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { PetSpritePlayer, type PetActionRow } from "./components/pet-sprite-player";
import { PublicSiteHeader } from "./components/public-site-header";
import type { PublicPet } from "./components/public-pet";
import { SiteFooter } from "./components/site-footer";

type HomepageResponse = {
  pets: PublicPet[];
  heroPetId: string | null;
  generatedAt: string;
};

const actorRows: PetActionRow[] = [3, 0, 4, 6, 8];

export default function Home() {
  const [pets, setPets] = useState<PublicPet[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    fetch("/api/homepage/pets", { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Homepage pets returned ${response.status}`);
        return response.json() as Promise<HomepageResponse>;
      })
      .then((data) => {
        setPets(Array.isArray(data.pets) ? data.pets.slice(0, 5) : []);
        setState("ready");
      })
      .catch(() => setState("error"));
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const chapters = Array.from(document.querySelectorAll<HTMLElement>("[data-story-step]"));
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => {
            const viewportCenter = window.innerHeight / 2;
            const leftCenter = left.boundingClientRect.top + left.boundingClientRect.height / 2;
            const rightCenter = right.boundingClientRect.top + right.boundingClientRect.height / 2;
            return Math.abs(leftCenter - viewportCenter) - Math.abs(rightCenter - viewportCenter);
          })[0];
        if (visible) setActiveStep(Number((visible.target as HTMLElement).dataset.storyStep ?? 0));
      },
      { threshold: 0, rootMargin: "-48% 0px -48% 0px" },
    );
    chapters.forEach((chapter) => observer.observe(chapter));
    return () => observer.disconnect();
  }, []);

  const visiblePets = useMemo(() => pets.slice(0, mobile ? 2 : 5), [mobile, pets]);
  const hero = pets[0] ?? null;

  return (
    <main className="story-page" data-story-active={activeStep}>
      <PublicSiteHeader />

      <div className="story-layout">
        <div className="story-stage-wrap" aria-live="polite">
          <div className="story-stage">
            <div className="story-window">
              <div className="story-window-bar">
                <span><i /><i /><i /></span>
                <strong>桌宠安装演示</strong>
                <small>{String(activeStep + 1).padStart(2, "0")} / 05</small>
              </div>

              <div className="story-scene story-scene--empty">
                <div className="story-settings-shell">
                  <aside>
                    <strong>Codex</strong>
                    <span>常规</span>
                    <span>外观</span>
                    <span className="active">宠物</span>
                    <span>插件</span>
                  </aside>
                  <section>
                    <div className="story-settings-heading">
                      <div>
                        <small>设置</small>
                        <strong>宠物</strong>
                      </div>
                      <button type="button" tabIndex={-1}>刷新</button>
                    </div>
                    <div className="story-empty-list">
                      <span>＋</span>
                      <strong>还没有桌宠</strong>
                      <p>安装完成后，它会出现在这里</p>
                    </div>
                  </section>
                </div>
              </div>

              <div className="story-scene story-scene--gallery" aria-label="桌宠库真实作品">
                <div className="story-scene-heading">
                  <span>桌宠库</span>
                  <strong>选择一只喜欢的桌宠</strong>
                </div>
                <div className="story-pick-grid">
                  {visiblePets.map((pet, index) => (
                    <Link href={`/pets/${pet.id}`} key={pet.id} title={`查看 ${pet.displayName}`}>
                      <div className="story-pick-preview">
                        <PetSpritePlayer
                          active={activeStep === 1}
                          name={pet.displayName}
                          row={actorRows[index] ?? 0}
                          src={`/api/pets/${pet.id}/preview`}
                        />
                      </div>
                      <strong>{pet.displayName}</strong>
                      <small>{pet.isOfficial ? "官方孵化" : pet.author || "社区创作者"}</small>
                    </Link>
                  ))}
                </div>
              </div>

              {hero && (
                <>
                  <div className="story-scene story-scene--selected">
                    <div className="story-selected-preview">
                      <PetSpritePlayer
                        active={activeStep === 2}
                        name={hero.displayName}
                        row={0}
                        size="detail"
                        src={`/api/pets/${hero.id}/preview`}
                      />
                    </div>
                    <div className="story-selected-info">
                      <span>已选择</span>
                      <h3>{hero.displayName}</h3>
                      <p>{hero.isOfficial ? "Codex Pet Club 官方" : hero.author || "社区创作者"}</p>
                      <div className="story-pet-id">
                        <small>唯一桌宠 ID</small>
                        <code title={hero.id}>{hero.id}</code>
                        <b>复制 ID</b>
                      </div>
                    </div>
                  </div>

                  <div className="story-scene story-scene--chat">
                    <div className="story-chat-shell">
                      <div className="story-chat-title"><span>C:</span><strong>和 Codex 对话</strong></div>
                      <div className="story-chat-user">
                        把这个桌宠下载到我本地，ID：<code>{hero.id}</code>
                      </div>
                      <div className="story-chat-reply">
                        <div className="story-chat-codex">C:</div>
                        <div>
                          <strong>桌宠安装完成</strong>
                          <p><span>✓</span> 找到“{hero.displayName}”</p>
                          <p><span>✓</span> 文件校验通过</p>
                          <p><span>✓</span> 已加入 Codex 宠物列表</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="story-scene story-scene--installed">
                    <div className="story-settings-shell">
                      <aside>
                        <strong>Codex</strong>
                        <span>常规</span>
                        <span>外观</span>
                        <span className="active">宠物</span>
                        <span>插件</span>
                      </aside>
                      <section>
                        <div className="story-settings-heading">
                          <div><small>设置</small><strong>宠物</strong></div>
                          <button type="button" tabIndex={-1}>刷新</button>
                        </div>
                        <div className="story-installed-row">
                          <div className="story-installed-pet">
                            <PetSpritePlayer
                              active={activeStep === 4}
                              name={hero.displayName}
                              row={3}
                              src={`/api/pets/${hero.id}/preview`}
                            />
                          </div>
                          <div><strong>{hero.displayName}</strong><small>已安装到本机</small></div>
                          <b>已添加</b>
                        </div>
                      </section>
                    </div>
                  </div>
                </>
              )}

              {state === "ready" && !hero && (
                <div className="story-data-state">
                  <strong>还没有已发布桌宠</strong>
                  <p>有作品通过审核后，这里会自动出现。</p>
                </div>
              )}

              {state !== "ready" && (
                <div className="story-data-state">
                  <strong>{state === "loading" ? "桌宠们正在赶来" : "社区暂时安静"}</strong>
                  <p>{state === "loading" ? "正在读取真实已发布作品…" : "稍后刷新，或先进入桌宠库看看。"}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="story-chapters">
          <section className="story-chapter" data-story-step="0">
            <span className="story-kicker">第 1 步</span>
            <h1>想给 Codex<br /><em>找个桌面搭档？</em></h1>
            <p>现在宠物列表还是空的。跟着下面四步，就能把喜欢的桌宠装进来。</p>
            <small>向下滚动，看看怎么安装</small>
          </section>

          <section className="story-chapter" data-story-step="1">
            <span className="story-kicker">第 2 步</span>
            <h2>先在桌宠库里<br />挑一只喜欢的。</h2>
            <p>左边展示的都是真实已发布作品。点开任意一只，就能查看它的动作和作者。</p>
          </section>

          <section className="story-chapter" data-story-step="2">
            <span className="story-kicker">第 3 步</span>
            <h2>复制它的<br />唯一桌宠 ID。</h2>
            <p>每只桌宠都有自己的 ID。网站不需要你手动下载文件，只要复制这串 ID。</p>
          </section>

          <section className="story-chapter" data-story-step="3">
            <span className="story-kicker">第 4 步</span>
            <h2>把 ID<br />直接发给 Codex。</h2>
            <p>照着左边说一句话。官方 Skill 会自动找到桌宠、校验文件并完成安装。</p>
          </section>

          <section className="story-chapter story-chapter--final" data-story-step="4">
            <span className="story-kicker">完成</span>
            <h2>安装完成，<br />宠物列表里见。</h2>
            <p>桌宠会自动出现在 Codex 的宠物列表里。现在去挑一只试试吧。</p>
            <div className="story-final-actions">
              <Link className="button button--primary" href="/pets">进入桌宠库 →</Link>
              <Link className="text-link" href="/skill#publish">分享我的桌宠 ↗</Link>
            </div>
          </section>
        </div>
      </div>

      <section className="story-community-footer">
        <span>真实作品 · 官方 Skill 安装</span>
        <h2>所有已发布桌宠，<br />都可以照这个方法安装。</h2>
        <Link href="/pets">浏览全部已发布桌宠 ↗</Link>
      </section>
      <SiteFooter note="真实作品，真实创作者，真实来到你的 Codex。" />
    </main>
  );
}
