"use client";

import { useMemo, useState } from "react";

type Category = "全部" | "像素" | "软萌" | "酷酷" | "极简";

type Pet = {
  name: string;
  slug: string;
  icon: string;
  category: Exclude<Category, "全部">;
  color: string;
  accent: string;
  description: string;
  author: string;
  downloads: string;
  tags: string[];
};

const categories: Category[] = ["全部", "像素", "软萌", "酷酷", "极简"];
const skillRepositoryUrl = "https://github.com/javaC2RenXiangjie/codex-pet-club-skill";

const pets: Pet[] = [
  {
    name: "像素柯基",
    slug: "pixel-corgi",
    icon: "🐶",
    category: "像素",
    color: "#f5a15b",
    accent: "#ffe0ae",
    description: "短腿但行动派。任务开始时冲刺，等待时会乖乖趴下。",
    author: "Mochi Lab",
    downloads: "2.4k",
    tags: ["8 帧动作", "PET JSON", "MIT"],
  },
  {
    name: "霓虹黑猫",
    slug: "neon-black-cat",
    icon: "🐈‍⬛",
    category: "酷酷",
    color: "#171a26",
    accent: "#a5f4d1",
    description: "安静巡视你的桌面，完成任务时尾巴会亮起一圈霓虹。",
    author: "Night Shift",
    downloads: "1.8k",
    tags: ["深色系", "PET JSON", "MIT"],
  },
  {
    name: "机械小龙",
    slug: "mecha-dragon",
    icon: "🐉",
    category: "酷酷",
    color: "#5f73c9",
    accent: "#d9ddff",
    description: "会在长任务里给自己充电，代码通过时喷出一小团蓝火。",
    author: "Byte Forge",
    downloads: "3.1k",
    tags: ["机甲", "PET JSON", "CC BY"],
  },
  {
    name: "云朵水獭",
    slug: "cloud-otter",
    icon: "🦦",
    category: "软萌",
    color: "#9dd5cb",
    accent: "#e4fff8",
    description: "抱着一小片云打滚，提醒你在长时间专注后喝水休息。",
    author: "Soft Hours",
    downloads: "4.6k",
    tags: ["治愈", "PET JSON", "MIT"],
  },
  {
    name: "代码幽灵",
    slug: "code-ghost",
    icon: "👻",
    category: "极简",
    color: "#b79be6",
    accent: "#f0e5ff",
    description: "从终端缝隙里飘出来，失败时缩成一颗小小的分号。",
    author: "Semi Colon",
    downloads: "1.2k",
    tags: ["极简", "PET JSON", "MIT"],
  },
  {
    name: "复古小电视",
    slug: "retro-tv",
    icon: "📺",
    category: "像素",
    color: "#ef6f5d",
    accent: "#ffd7bd",
    description: "把状态变成频道：思考、运行、等待和完成各有一套雪花屏。",
    author: "Channel 88",
    downloads: "2.9k",
    tags: ["复古", "PET JSON", "CC0"],
  },
];

function PetPreview({ pet, large = false }: { pet: Pet; large?: boolean }) {
  return (
    <div
      className={`pet-preview${large ? " pet-preview--large" : ""}`}
      style={{
        "--pet-color": pet.color,
        "--pet-accent": pet.accent,
      } as React.CSSProperties}
      aria-hidden="true"
    >
      <span className="pixel-dot pixel-dot--one" />
      <span className="pixel-dot pixel-dot--two" />
      <span className="pet-emoji">{pet.icon}</span>
      <span className="pet-shadow" />
      <span className="pet-status">IDLE</span>
    </div>
  );
}

export default function Home() {
  const [category, setCategory] = useState<Category>("全部");
  const [query, setQuery] = useState("");
  const [showSubmit, setShowSubmit] = useState(false);
  const [toast, setToast] = useState("");

  const filteredPets = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return pets.filter((pet) => {
      const inCategory = category === "全部" || pet.category === category;
      const inSearch =
        !keyword ||
        [pet.name, pet.description, pet.author, pet.category, ...pet.tags]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      return inCategory && inSearch;
    });
  }, [category, query]);

  function flash(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  async function copyChecklist() {
    const checklist =
      "Codex Pet Club 投稿清单：\n1. 桌宠名称与一句话介绍\n2. 源文件压缩包\n3. 预览图或 GIF\n4. 开源许可\n5. 作者署名与链接";
    try {
      await navigator.clipboard.writeText(checklist);
      flash("投稿清单已复制");
    } catch {
      flash("请下载投稿模板查看清单");
    }
  }

  async function copySkillPrompt() {
    const prompt = `使用 $codex-pet-club，把桌宠库配置为 ${window.location.origin}，然后列出可以直接安装的桌宠。`;
    try {
      await navigator.clipboard.writeText(prompt);
      flash("Skill 使用提示已复制，粘贴给 Codex 即可");
    } catch {
      flash("请先下载 Skill，再让 Codex 配置当前站点");
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
          <a href="#catalog">逛桌宠</a>
          <a href="#skill">官方 Skill</a>
          <a href="#how-it-works">使用说明</a>
          <button className="nav-submit" onClick={() => setShowSubmit(true)}>
            分享我的桌宠 <span aria-hidden="true">↗</span>
          </button>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span>OPEN SOURCE</span> · MADE FOR CODEX</div>
          <h1>领一只会陪你<br />工作的桌宠</h1>
          <p>
            找到喜欢的桌宠，直接下载可编辑的源文件。换配色、改动作、加性格，
            再把你的版本分享回来。
          </p>
          <div className="hero-actions">
            <a className="button button--primary" href={skillRepositoryUrl} target="_blank" rel="noreferrer">
              GitHub 获取 Skill <span aria-hidden="true">↗</span>
            </a>
            <a className="text-link" href="#catalog">
              先逛逛桌宠 <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="trust-row" aria-label="社区数据">
            <span><strong>06</strong> 首发桌宠</span>
            <span><strong>100%</strong> 开放源文件</span>
            <span><strong>01</strong> 官方自动化 Skill</span>
          </div>
        </div>

        <div className="hero-stage" aria-label="桌宠预览">
          <div className="stage-note stage-note--top">今天也一起写点好东西</div>
          <div className="hero-pet hero-pet--one"><PetPreview pet={pets[0]} large /></div>
          <div className="hero-pet hero-pet--two"><PetPreview pet={pets[3]} /></div>
          <div className="hero-pet hero-pet--three"><PetPreview pet={pets[4]} /></div>
          <div className="stage-window">
            <div className="window-bar"><i /><i /><i /><span>pet-playground.tsx</span></div>
            <code>
              <span>const</span> today = <b>&quot;有桌宠陪伴&quot;</b>;<br />
              <span>export</span> default today;
            </code>
          </div>
          <div className="stage-sticker">SOURCE<br />INSIDE</div>
        </div>
      </section>

      <div className="ticker" aria-hidden="true">
        <div>DOWNLOAD · REMIX · SHARE · DOWNLOAD · REMIX · SHARE · DOWNLOAD · REMIX · SHARE ·</div>
      </div>

      <section className="catalog-section" id="catalog">
        <div className="section-heading">
          <div>
            <span className="section-kicker">PET LIBRARY / 001</span>
            <h2>挑一只带走</h2>
          </div>
          <p>每份下载都包含可编辑配置、使用说明与许可文件。先拿走，慢慢改。</p>
        </div>

        <div className="catalog-toolbar">
          <div className="filters" role="group" aria-label="按风格筛选">
            {categories.map((item) => (
              <button
                key={item}
                className={category === item ? "active" : ""}
                onClick={() => setCategory(item)}
                aria-pressed={category === item}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">搜索桌宠</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索名字、作者或标签"
            />
            <kbd>⌘ K</kbd>
          </label>
        </div>

        <div className="catalog-notice">
          <span>BETA</span>
          当前卡片是创意源包；通过 v2 校验和审核的桌宠会出现“用 Skill 安装”标记，并支持一句话装进 Codex。
        </div>

        {filteredPets.length > 0 ? (
          <div className="pet-grid">
            {filteredPets.map((pet, index) => (
              <article className="pet-card" key={pet.slug}>
                <div className="card-number">{String(index + 1).padStart(2, "0")}</div>
                <PetPreview pet={pet} />
                <div className="pet-meta">
                  <span className="category-pill">{pet.category}</span>
                  <span className="download-count">↓ {pet.downloads}</span>
                </div>
                <h3>{pet.name}</h3>
                <p>{pet.description}</p>
                <div className="tag-row">
                  {pet.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>
                <div className="card-footer">
                  <div className="author">
                    <span>{pet.author.slice(0, 1)}</span>
                    <small>by {pet.author}</small>
                  </div>
                  <a
                    href={`/downloads/${pet.slug}-source.zip`}
                    download
                    onClick={() => flash(`${pet.name} 源码包开始下载`)}
                    aria-label={`下载 ${pet.name} 源码包`}
                  >
                    拿源文件 <span aria-hidden="true">↘</span>
                  </a>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span>∅</span>
            <h3>暂时没找到这只桌宠</h3>
            <p>换个关键词，或者清空筛选继续逛。</p>
            <button onClick={() => { setCategory("全部"); setQuery(""); }}>清空筛选</button>
          </div>
        )}
      </section>

      <section className="skill-section" id="skill">
        <div className="skill-copy">
          <div className="skill-badge"><span>OFFICIAL</span> SKILL · BETA</div>
          <h2>以后不用再<br />手动搬文件。</h2>
          <p>
            安装一次 Codex Pet Club Skill，以后只要告诉 Codex 想领养哪只桌宠，
            或者把本地哪只桌宠分享出去。下载、校验、备份、安装和投稿都由 Skill 完成。
          </p>
          <div className="skill-actions">
            <a className="button button--primary" href={skillRepositoryUrl} target="_blank" rel="noreferrer">
              GitHub 查看源码 <span aria-hidden="true">↗</span>
            </a>
            <a className="text-link" href="/downloads/codex-pet-club-skill.zip" download onClick={() => flash("官方 Skill 开始下载")}>直接下载 ZIP</a>
            <button className="text-link" onClick={copySkillPrompt}>复制使用提示</button>
          </div>
          <small>上传默认进入审核队列；远端文件在安装前会自动验证 v2 清单、图集尺寸和校验和。</small>
        </div>

        <div className="skill-console" aria-label="Codex Pet Club Skill 使用示例">
          <div className="console-title"><i /><i /><i /><span>Codex · Pet Club</span><b>CONNECTED</b></div>
          <div className="chat-line chat-line--user">
            <span>YOU</span>
            <p>帮我安装桌宠库里的像素柯基</p>
          </div>
          <div className="chat-line chat-line--codex">
            <span>CODEX</span>
            <div>
              <p>正在验证远端包…</p>
              <code>✓ spriteVersionNumber: 2</code>
              <code>✓ atlas: 1536 × 2288</code>
              <code>✓ checksum matched</code>
              <strong>已安装到你的 Codex 桌宠目录。</strong>
            </div>
          </div>
          <div className="console-divider">OR PUBLISH YOUR OWN</div>
          <div className="chat-line chat-line--user chat-line--compact">
            <span>YOU</span>
            <p>把我本地的机械小龙分享到桌宠库</p>
          </div>
          <div className="queue-status"><span>UPLOAD</span><b>已提交 · 等待审核</b><em>#PET-7F3A</em></div>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <div className="how-intro">
          <span className="section-kicker">HOW IT WORKS / 002</span>
          <h2>下载后，<br />它就是你的了。</h2>
          <p>所有桌宠都带清晰许可。你可以直接拿源文件，也可以让官方 Skill 自动完成安装与投稿。</p>
        </div>
        <ol className="steps">
          <li><span>01</span><div><strong>挑喜欢的</strong><p>按风格筛选，先看性格和动作设定。</p></div></li>
          <li><span>02</span><div><strong>让 Skill 安装</strong><p>自动下载、校验、备份旧版本，再装进 Codex。</p></div></li>
          <li><span>03</span><div><strong>改成你的版本</strong><p>换颜色、改动作，Skill 会先验证本地 v2 包。</p></div></li>
          <li><span>04</span><div><strong>一句话发布</strong><p>自动打包上传，审核通过后进入公共桌宠库。</p></div></li>
        </ol>
      </section>

      <section className="contribute-cta">
        <div className="cta-pets" aria-hidden="true"><span>🐈‍⬛</span><span>👻</span><span>🐶</span></div>
        <div>
          <span className="section-kicker">COMMUNITY DROP</span>
          <h2>你的脑洞，<br />也值得被领养。</h2>
          <p>告诉 Codex“把我本地的桌宠分享出去”，Skill 会校验、打包并送入审核队列。</p>
        </div>
        <button className="button button--dark" onClick={() => setShowSubmit(true)}>
          查看发布方式 <span aria-hidden="true">↗</span>
        </button>
      </section>

      <footer>
        <a className="brand brand--footer" href="#top">
          <span className="brand-mark">C:</span>
          <span><strong>Codex Pet Club</strong><small>桌宠开源俱乐部</small></span>
        </a>
        <p>给认真工作的人，一点可爱的陪伴。</p>
        <div><a href="#catalog">桌宠目录</a><a href={skillRepositoryUrl} target="_blank" rel="noreferrer">GitHub 源码</a><a href="#how-it-works">使用说明</a><button onClick={() => setShowSubmit(true)}>投稿</button></div>
      </footer>

      {showSubmit && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowSubmit(false)}>
          <section className="submit-modal" role="dialog" aria-modal="true" aria-labelledby="submit-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" aria-label="关闭投稿说明" onClick={() => setShowSubmit(false)}>×</button>
            <span className="modal-icon">↗</span>
            <span className="section-kicker">SHARE A PET</span>
            <h2 id="submit-title">把你的桌宠放进来</h2>
            <p>准备好下面 5 样内容，就可以交给站点维护者收录：</p>
            <ul>
              <li>桌宠名称与一句话介绍</li>
              <li>可编辑源文件，或已完成的 Codex v2 桌宠包</li>
              <li>透明背景预览图或 GIF</li>
              <li>明确的开源许可</li>
              <li>作者署名与链接</li>
            </ul>
                <div className="modal-actions">
                  <a className="button button--primary" href="/downloads/codex-pet-club-skill.zip" download onClick={() => flash("官方 Skill 开始下载")}>用 Skill 自动发布</a>
                  <button className="text-link" onClick={copyChecklist}>仍然手动投稿</button>
                  <a className="text-link" href="/downloads/contributor-template.zip" download>下载手动模板</a>
                </div>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </main>
  );
}
