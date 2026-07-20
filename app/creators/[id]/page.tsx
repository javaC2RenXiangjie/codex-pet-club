import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PetSpritePlayer } from "../../components/pet-sprite-player";
import { SiteFooter } from "../../components/site-footer";
import {
  getPublicCreatorProfile,
  RegistryError,
} from "../../../lib/pet-registry";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

async function findCreator(id: string) {
  try {
    return await getPublicCreatorProfile(id);
  } catch (error) {
    if (error instanceof RegistryError && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const creator = await findCreator((await params).id);
  if (!creator) return { title: "创作者未找到 · Codex Pet Club" };
  const description = `${creator.displayName} 在 Codex Pet Club 发布的 ${creator.pets.length} 只桌宠。`;
  return {
    title: `${creator.displayName} · Codex Pet Club 创作者`,
    description,
    alternates: { canonical: `/creators/${creator.id}` },
    openGraph: {
      title: `${creator.displayName} · Codex Pet Club`,
      description,
      type: "profile",
      images: [{ url: "/og.png", width: 1200, height: 630 }],
    },
  };
}

export default async function CreatorPage({ params }: PageProps) {
  const creator = await findCreator((await params).id);
  if (!creator) notFound();
  return (
    <main className="creator-page">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Codex Pet Club 首页">
          <span className="brand-mark">C:</span>
          <span><strong>Codex Pet Club</strong><small>公开创作者主页</small></span>
        </Link>
        <nav aria-label="主导航">
          <Link href="/#catalog">桌宠库</Link>
          <Link href="/skill">安装 Skill</Link>
          <Link href="/account">创作者账户</Link>
        </nav>
      </header>

      <section className="creator-hero">
        <Link href="/#catalog">← 返回桌宠库</Link>
        <div className="creator-avatar">{creator.displayName.slice(0, 1).toUpperCase()}</div>
        <span className="section-kicker">VERIFIED CREATOR</span>
        <h1>{creator.displayName}</h1>
        <p>已发布 {creator.pets.length} 只桌宠 · 加入于 {new Date(creator.joinedAt).toLocaleDateString("zh-CN")}</p>
        <small>此页面只展示公开名称与已发布作品，不公开邮箱或账户凭证。</small>
      </section>

      <section className="creator-pets" aria-labelledby="creator-pets-title">
        <div className="section-heading">
          <div><span className="section-kicker">PUBLISHED PETS</span><h2 id="creator-pets-title">已发布桌宠</h2></div>
          <p>点击桌宠进入独立详情页，预览全部动作并复制 Skill 安装指令。</p>
        </div>
        <div className="creator-pet-grid">
          {creator.pets.map((pet) => (
            <Link className="creator-pet-card" href={`/pets/${pet.id}`} key={pet.id}>
              <div className="creator-pet-preview">
                <PetSpritePlayer name={pet.displayName} src={`/api/pets/${pet.id}/preview`} />
              </div>
              <div>
                <span>{pet.category.toUpperCase()} · v{pet.version}</span>
                <h2>{pet.displayName}</h2>
                <p>{pet.description || "这只桌宠暂时没有介绍。"}</p>
                <div>{pet.tags.slice(0, 4).map((tag) => <small key={tag}>#{tag}</small>)}</div>
                <strong>查看动作与安装 ID ↗</strong>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
