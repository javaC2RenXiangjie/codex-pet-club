"use client";

import { useEffect, useMemo, useState } from "react";

type Pet = {
  name: string;
  slug: string;
  icon: string;
  category: string;
  color: string;
  accent: string;
  description: string;
  author: string;
  downloads: string;
  tags: string[];
};

type RegistryPet = {
  id: string;
  petKey: string;
  displayName: string;
  description: string;
  author: string;
  license: string;
  sha256: string;
  sizeBytes: number;
  updatedAt: string;
};

const skillRepositoryUrl = "https://github.com/javaC2RenXiangjie/codex-pet-club-skill";

const heroPets: Pet[] = [
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

function RegistryPetPreview({ pet, index }: { pet: RegistryPet; index: number }) {
  const palettes = [
    ["#f5a15b", "#ffe0ae"],
    ["#171a26", "#a5f4d1"],
    ["#5f73c9", "#d9ddff"],
    ["#9dd5cb", "#e4fff8"],
    ["#b79be6", "#f0e5ff"],
    ["#ef6f5d", "#ffd7bd"],
  ];
  const [color, accent] = palettes[index % palettes.length];
  return (
    <div
      className="pet-preview"
      style={{ "--pet-color": color, "--pet-accent": accent } as React.CSSProperties}
      aria-hidden="true"
    >
      <span className="pixel-dot pixel-dot--one" />
      <span className="pixel-dot pixel-dot--two" />
      <span className="pet-emoji pet-emoji--letter">{pet.displayName.slice(0, 1)}</span>
      <span className="pet-shadow" />
      <span className="pet-status">V2 READY</span>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [showSubmit, setShowSubmit] = useState(false);
  const [toast, setToast] = useState("");
  const [registryPets, setRegistryPets] = useState<RegistryPet[]>([]);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    fetch("/api/pets", { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Registry returned ${response.status}`);
        return response.json() as Promise<{ pets?: RegistryPet[] }>;
      })
      .then((data) => {
        if (!active) return;
        setRegistryPets(Array.isArray(data.pets) ? data.pets : []);
        setCatalogState("ready");
      })
      .catch(() => {
        if (active) setCatalogState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredPets = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return registryPets.filter((pet) =>
      !keyword ||
      [pet.id, pet.petKey, pet.displayName, pet.description, pet.author, pet.license]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [query, registryPets]);

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

  async function copySkillPrompt() {
    const prompt = `使用 $codex-pet-club，把桌宠库配置为 ${window.location.origin}。以后我提供桌宠 ID 时，只通过 Skill 下载、校验并安装到 Codex。`;
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
            在网站找到喜欢的桌宠，复制它的唯一 ID，再交给官方 Skill。
            下载、校验和安装全部由 Codex 自动完成。
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
            <span><strong>{String(registryPets.length).padStart(2, "0")}</strong> 已发布桌宠</span>
            <span><strong>1 ID</strong> 对应一个桌宠</span>
            <span><strong>SKILL</strong> 唯一安装通道</span>
          </div>
        </div>

        <div className="hero-stage" aria-label="桌宠预览">
          <div className="stage-note stage-note--top">今天也一起写点好东西</div>
          <div className="hero-pet hero-pet--one"><PetPreview pet={heroPets[0]} large /></div>
          <div className="hero-pet hero-pet--two"><PetPreview pet={heroPets[3]} /></div>
          <div className="hero-pet hero-pet--three"><PetPreview pet={heroPets[4]} /></div>
          <div className="stage-window">
            <div className="window-bar"><i /><i /><i /><span>pet-playground.tsx</span></div>
            <code>
              <span>const</span> today = <b>&quot;有桌宠陪伴&quot;</b>;<br />
              <span>export</span> default today;
            </code>
          </div>
          <div className="stage-sticker">SKILL<br />ONLY</div>
        </div>
      </section>

      <div className="ticker" aria-hidden="true">
        <div>FIND · COPY ID · ASK CODEX · INSTALL · FIND · COPY ID · ASK CODEX · INSTALL ·</div>
      </div>

      <section className="catalog-section" id="catalog">
        <div className="section-heading">
          <div>
            <span className="section-kicker">PET LIBRARY / 001</span>
            <h2>挑一只带走</h2>
          </div>
          <p>这里只展示已经通过 v2 校验并发布的桌宠；网页不提供任何桌宠文件直链。</p>
        </div>

        <div className="catalog-toolbar">
          <div className="filters" role="group" aria-label="按风格筛选">
            <button className="active" aria-pressed="true">全部已发布</button>
          </div>
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">搜索桌宠</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索名字、作者或桌宠 ID"
            />
            <kbd>⌘ K</kbd>
          </label>
        </div>

        <div className="catalog-notice">
          <span>SKILL ONLY</span>
          复制卡片中的唯一 ID，然后对 Codex 说：“把这个桌宠下载到我本地，ID：xxxxxxxx”。
        </div>

        {catalogState === "ready" && filteredPets.length > 0 ? (
          <div className="pet-grid">
            {filteredPets.map((pet, index) => (
              <article className="pet-card" key={pet.id}>
                <div className="card-number">{String(index + 1).padStart(2, "0")}</div>
                <RegistryPetPreview pet={pet} index={index} />
                <div className="pet-meta">
                  <span className="category-pill">CODEX V2</span>
                  <span className="download-count">SKILL ONLY</span>
                </div>
                <h3>{pet.displayName}</h3>
                <p>{pet.description}</p>
                <div className="tag-row">
                  <span>{pet.license}</span>
                  <span>{pet.petKey}</span>
                  <span>SHA-256</span>
                </div>
                <button className="pet-id" onClick={() => copyPetCommand(pet)} aria-label={`复制 ${pet.displayName} 的桌宠 ID`}>
                  <small>UNIQUE PET ID</small>
                  <code>{pet.id}</code>
                  <span>复制</span>
                </button>
                <div className="card-footer">
                  <div className="author">
                    <span>{(pet.author || "C").slice(0, 1)}</span>
                    <small>by {pet.author || "Community"}</small>
                  </div>
                  <button onClick={() => copyPetCommand(pet)}>
                    复制安装指令 <span aria-hidden="true">↗</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span>{catalogState === "loading" ? "…" : "∅"}</span>
            <h3>{catalogState === "loading" ? "正在连接桌宠库" : catalogState === "error" ? "桌宠库暂时不可用" : query ? "没有匹配的桌宠" : "首批桌宠正在审核上架"}</h3>
            <p>{catalogState === "ready" ? "只有验证通过、确实能装进 Codex 的桌宠才会出现在这里。" : "稍后刷新页面重试。"}</p>
            {query && <button onClick={() => setQuery("")}>清空搜索</button>}
          </div>
        )}
      </section>

      <section className="skill-section" id="skill">
        <div className="skill-copy">
          <div className="skill-badge"><span>OFFICIAL</span> SKILL · BETA</div>
          <h2>以后不用再<br />手动搬文件。</h2>
          <p>
            安装一次 Codex Pet Club Skill。以后从网站复制唯一 ID，告诉 Codex
            “把这个桌宠下载到我本地”，Skill 就会完成下载、校验、备份和安装。
          </p>
          <div className="skill-actions">
            <a className="button button--primary" href={skillRepositoryUrl} target="_blank" rel="noreferrer">
              GitHub 查看源码 <span aria-hidden="true">↗</span>
            </a>
            <a className="text-link" href="/downloads/codex-pet-club-skill.zip" download onClick={() => flash("官方 Skill 开始下载")}>直接下载 ZIP</a>
            <button className="text-link" onClick={copySkillPrompt}>复制使用提示</button>
          </div>
          <small>网站不暴露桌宠包直链；Skill 会按 ID 请求文件，并验证 v2 清单、图集尺寸和校验和。</small>
        </div>

        <div className="skill-console" aria-label="Codex Pet Club Skill 使用示例">
          <div className="console-title"><i /><i /><i /><span>Codex · Pet Club</span><b>CONNECTED</b></div>
          <div className="chat-line chat-line--user">
            <span>YOU</span>
            <p>把这个桌宠下载到我本地，ID：9d1ef2a4-55df-4d99-a722-18d1db7cb83a</p>
          </div>
          <div className="chat-line chat-line--codex">
            <span>CODEX</span>
            <div>
              <p>正在验证远端包…</p>
              <code>✓ spriteVersionNumber: 2</code>
              <code>✓ atlas: 1536 × 2288</code>
              <code>✓ checksum matched</code>
              <strong>已安装到 ~/.codex/pets，刷新“宠物”列表即可看到。</strong>
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
          <h2>复制 ID，<br />剩下交给 Codex。</h2>
          <p>桌宠文件不从网页下载。唯一 ID 是网站和 Skill 之间的安装凭证。</p>
        </div>
        <ol className="steps">
          <li><span>01</span><div><strong>挑喜欢的</strong><p>网站只展示已验证、可安装的 Codex v2 桌宠。</p></div></li>
          <li><span>02</span><div><strong>复制唯一 ID</strong><p>每只桌宠一个 ID，不提供文件下载按钮。</p></div></li>
          <li><span>03</span><div><strong>交给 Skill</strong><p>Codex 按 ID 下载、验签、备份并写入桌宠目录。</p></div></li>
          <li><span>04</span><div><strong>刷新列表</strong><p>打开设置里的“宠物”，刷新后直接选择新桌宠。</p></div></li>
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
            <p>投稿也只通过官方 Skill 完成。准备好下面内容，然后告诉 Codex“把我本地的桌宠分享到桌宠库”：</p>
            <ul>
              <li>桌宠名称与一句话介绍</li>
              <li>可编辑源文件，或已完成的 Codex v2 桌宠包</li>
              <li>透明背景预览图或 GIF</li>
              <li>明确的开源许可</li>
              <li>作者署名与链接</li>
            </ul>
                <div className="modal-actions">
                  <a className="button button--primary" href="/downloads/codex-pet-club-skill.zip" download onClick={() => flash("官方 Skill 开始下载")}>用 Skill 自动发布</a>
                  <button className="text-link" onClick={copySkillPrompt}>复制 Skill 配置提示</button>
                </div>
          </section>
        </div>
      )}

      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </main>
  );
}
