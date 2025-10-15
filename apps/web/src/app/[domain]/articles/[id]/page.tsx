import { getPrisma } from "@/lib/db";
import { summarizeText } from "@/app/actions/summarize";
import { Suspense } from "react";
import LikeButton from "@/components/LikeButton";
import { getLikeCounts, getUserLikedSet, getLikers } from "@/lib/likes";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/nextauth-options";
import { parseKeywords } from "@/lib/keywords";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Calendar, Building2, Heart, Users, Sparkles, Leaf, Shield, User2, Clock } from "lucide-react";
import SafeHTMLContent from "@/components/SafeHTMLContent";

async function fetchArticle(domain: "esg" | "credit", id: string) {
  const prisma = getPrisma(domain);
  const idNum = Number(id);
  if (!Number.isFinite(idNum)) return null;

  if (domain === "credit") {
    const rows = await prisma.$queryRaw<{
      id: number;
      title: string | null;
      source: string | null;
      link: string | null;
      date: Date | null;
      content: string | null;          // <-- CREDIT has content
      matched_keywords?: unknown;
    }[]>`
      SELECT id, title, source, link, date, content, matched_keywords
      FROM credit_articles
      WHERE id = ${idNum}
      LIMIT 1;
    `;
    return rows[0] ?? null;
  } else {
    const rows = await prisma.$queryRaw<{
      id: number | string;
      title: string | null;
      source: string | null;
      link: string | null;
      date: Date | null;
      summary: string | null;          // <-- ESG has summary
      matched_keywords?: unknown;
    }[]>`
      SELECT id, title, source, link,
             COALESCE(published, save_time) AS date,
             summary,
             matched_keywords
      FROM esg_articles
      WHERE id = ${idNum}
      LIMIT 1;
    `;
    return rows[0] ?? null;
  }
}


export const revalidate = 0;

export default async function ArticleDetail({
  params,
}: { params: { domain: "esg" | "credit"; id: string } }) {
  const item = await fetchArticle(params.domain, params.id);
  if (!item) {
    return <div className="mx-auto max-w-3xl p-6">Not found</div>;
  }

  const body =
    params.domain === "esg" ? (item as any).summary ?? "" : (item as any).content ?? "";

  // after you compute `item`, also compute like meta:
  const session = await getServerSession(authOptions);
  const userId = Number((session?.user as any)?.id || 0);
  const contentId = Number(params.id);
  let likeCount = 0, liked = false;
  const likers = Number.isFinite(contentId)
    ? await getLikers(params.domain, "article", contentId)
    : [];
  if (Number.isFinite(contentId)) {
    const [countMap, likedSet] = await Promise.all([
      getLikeCounts(params.domain, "article", [contentId]),
      getUserLikedSet(params.domain, userId, "article", [contentId]),
    ]);
    likeCount = countMap[contentId] ?? 0;
    liked = likedSet.has(contentId);
  }

  // Compute clean names for safe UI rendering
  const likerNames = (likers || [])
    .map(u => (u.name ?? "").trim())
    .filter(Boolean); // drop empties just in case

  const keywords = parseKeywords((item as any).matched_keywords);

  // provider enabled?
  const providerReady =
    !!process.env.CUSTOM_AI_KEY &&
    !!process.env.CUSTOM_AI_URL &&
    !process.env.CUSTOM_AI_URL.includes("<") &&
    !process.env.CUSTOM_AI_URL.includes(">");

  const getESGIcon = () => {
    switch (params.domain) {
      case "esg":
        return <Leaf className="w-8 h-8 text-white" />;
      default:
        return <Building2 className="w-8 h-8 text-white" />;
    }
  };

  const getESGColor = () => {
    switch (params.domain) {
      case "esg":
        return "from-green-500 to-blue-600";
      default:
        return "from-blue-500 to-purple-600";
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-green-50">
      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Header with Back Navigation */}
        <div className="mb-8">
          <Link 
            href={`/${params.domain}/articles`}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium">Back to Articles</span>
          </Link>
        </div>

        {/* Article Header */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8">
          {/* Hero Section */}
          <div className={`bg-gradient-to-r ${getESGColor()} p-8 text-white`}>
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                  {getESGIcon()}
                </div>
              </div>
              <div className="flex-1">
                <h1 className="text-3xl font-bold leading-tight mb-4">
                  {item.title ?? "Untitled Article"}
                </h1>
                
                {/* Article Meta */}
                <div className="flex items-center gap-6 text-white/90">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    <span className="font-medium">{item.source ?? "Unknown Source"}</span>
                  </div>
                  {item.date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      <time dateTime={new Date(item.date).toISOString()}>
                        {new Date(item.date).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </time>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{Math.ceil((body?.length || 0) / 1000)} min read</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Keywords */}
            {keywords.length > 0 && (
              <div className="mt-6 flex flex-wrap gap-2">
                {keywords.slice(0, 8).map((k) => (
                  <span 
                    key={k} 
                    className="bg-white/20 text-white px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm"
                  >
                    {k}
                  </span>
                ))}
                {keywords.length > 8 && (
                  <span className="bg-white/10 text-white/80 px-3 py-1 rounded-full text-sm backdrop-blur-sm">
                    +{keywords.length - 8} more
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="p-6 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {item.link ? (
                  <a 
                    href={item.link} 
                    target="_blank"
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Read Original
                  </a>
                ) : (
                  <span className="text-gray-400 text-sm">Original link not available</span>
                )}

                {/* ESG Categories (for ESG domain) */}
                {params.domain === "esg" && (
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-green-600 bg-green-50 px-3 py-1 rounded-lg">
                      <Leaf className="w-4 h-4" />
                      <span className="text-sm font-medium">Environmental</span>
                    </div>
                    <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
                      <Users className="w-4 h-4" />
                      <span className="text-sm font-medium">Social</span>
                    </div>
                    <div className="flex items-center gap-1 text-purple-600 bg-purple-50 px-3 py-1 rounded-lg">
                      <Shield className="w-4 h-4" />
                      <span className="text-sm font-medium">Governance</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Like Button */}
              {Number.isFinite(contentId) && (
                <div className="flex items-center gap-4">
                  <LikeButton
                    domain={params.domain}
                    contentId={contentId}
                    initialLiked={liked}
                    initialCount={likeCount}
                  />
                </div>
              )}
            </div>

            {/* Likers */}
            {likerNames.length > 0 && (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                <Heart className="w-4 h-4 text-red-500" />
                <span>
                  Liked by <span className="font-medium">{likerNames.slice(0, 3).join(", ")}</span>
                  {likerNames.length > 3 && <span> and {likerNames.length - 3} others</span>}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* AI Summary */}
        {params.domain === "esg" && providerReady && body && (
          <div className="mb-8">
            <Suspense fallback={
              <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">AI Summary</h3>
                    <p className="text-gray-600">Generating intelligent summary...</p>
                  </div>
                </div>
                <div className="animate-pulse bg-gray-200 h-20 rounded-xl"></div>
              </div>
            }>
              <Summarizer body={body} />
            </Suspense>
          </div>
        )}

        {/* Article Content */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Article Content</h3>
                <p className="text-gray-600">Full article details and insights</p>
              </div>
            </div>

            <article className="prose prose-lg prose-gray max-w-none prose-headings:text-gray-900 prose-p:text-gray-800 prose-p:leading-relaxed prose-p:mb-4 prose-a:text-blue-600 prose-a:font-medium hover:prose-a:text-blue-700 hover:prose-a:underline prose-strong:text-gray-900 prose-em:text-gray-700 prose-ul:text-gray-800 prose-ol:text-gray-800 prose-li:mb-2">
              {body ? (
                <SafeHTMLContent 
                  htmlContent={body}
                  className="article-content text-gray-800 leading-relaxed [&>p]:mb-4 [&>p]:leading-7 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:text-gray-900 [&>h1]:mb-4 [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:text-gray-900 [&>h2]:mb-3 [&>h3]:text-lg [&>h3]:font-semibold [&>h3]:text-gray-900 [&>h3]:mb-3 [&_a]:text-blue-600 [&_a]:font-medium [&_a]:border-b [&_a]:border-blue-200 hover:[&_a]:text-blue-700 hover:[&_a]:border-blue-300 [&_a]:transition-colors [&_a]:pb-0.5 [&>strong]:font-semibold [&>strong]:text-gray-900 [&>em]:italic [&>em]:text-gray-700 [&>ul]:list-disc [&>ul]:ml-6 [&>ul]:mb-4 [&>ol]:list-decimal [&>ol]:ml-6 [&>ol]:mb-4 [&>li]:mb-1 [&>blockquote]:border-l-4 [&>blockquote]:border-blue-200 [&>blockquote]:pl-4 [&>blockquote]:py-2 [&>blockquote]:bg-blue-50 [&>blockquote]:text-gray-700 [&>blockquote]:italic"
                />
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                  <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Content Not Available</h4>
                  <p className="text-gray-600">Please use the &quot;Read Original&quot; link to view the full article content.</p>
                </div>
              )}
            </article>
          </div>
        </div>
      </div>
    </main>
  );
}

async function Summarizer({ body }: { body: string }) {
  if (!body) {
    return null;
  }
  const res = await summarizeText(body.slice(0, 8000)); // keep payload sane
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">AI Summary</h3>
            <p className="text-white/90 text-sm">Intelligent analysis powered by AI</p>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
          {res.ok ? res.summary : res.summary}
        </div>
        <div className="mt-4 p-3 bg-purple-50 rounded-lg">
          <p className="text-xs text-purple-700">
            <Sparkles className="w-3 h-3 inline mr-1" />
            This summary was generated using AI and may not capture all nuances of the original article.
          </p>
        </div>
      </div>
    </div>
  );
}