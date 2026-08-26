import type { Request, Response } from 'express';

type NewsSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

type FeedItem = {
  title: string;
  link: string;
  pubDate: string;
  source: string;
};

const decodeEntities = (value: string) => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .trim();

const textOf = (block: string, tag: string) => {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeEntities(match[1]) : '';
};

const hasJapanese = (text: string) => /[ぁ-んァ-ン一-龯]/.test(text);

async function fetchJapaneseNews(query: string): Promise<FeedItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ja&gl=JP&ceid=JP:ja`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; KioxiaSignal/1.0)',
      Accept: 'application/rss+xml,application/xml,text/xml,*/*',
    },
  });
  if (!response.ok) throw new Error(`Google News RSS ${response.status}`);
  const xml = await response.text();
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  return blocks.map((block) => ({
    title: textOf(block, 'title'),
    link: textOf(block, 'link'),
    pubDate: textOf(block, 'pubDate'),
    source: textOf(block, 'source') || 'Google News',
  })).filter((item) => item.title && item.link);
}

function stripSourceSuffix(title: string) {
  return title.replace(/\s+-\s+[^-]+$/, '').trim();
}

function classify(title: string): { sentiment: NewsSentiment; importance: 'HIGH' | 'MEDIUM' | 'LOW'; impact: string; tags: string[] } {
  const positive = /上昇|増益|増収|好調|成長|拡大|需要増|最高|買い|強気|上方|回復|反発|増産|投資拡大|AI需要/i;
  const negative = /下落|減益|減収|懸念|リスク|弱気|下方|失速|急落|赤字|減産|規制|不振|低迷/i;
  const sentiment: NewsSentiment = negative.test(title) ? 'NEGATIVE' : positive.test(title) ? 'POSITIVE' : 'NEUTRAL';
  const importance = /キオクシア|Kioxia|285A/i.test(title) ? 'HIGH' : /NAND|SSD|SanDisk|サンディスク|Micron|マイクロン|NVIDIA|エヌビディア|半導体|メモリ/i.test(title) ? 'MEDIUM' : 'LOW';
  const tags = [
    [/キオクシア|Kioxia/i, 'Kioxia'],
    [/NAND/i, 'NAND'],
    [/SSD/i, 'SSD'],
    [/SanDisk|サンディスク/i, 'SanDisk'],
    [/Micron|マイクロン/i, 'Micron'],
    [/NVIDIA|エヌビディア/i, 'NVIDIA'],
    [/半導体/i, 'Semiconductor'],
  ].filter(([re]) => (re as RegExp).test(title)).map(([, tag]) => String(tag));
  const impact = sentiment === 'POSITIVE'
    ? '半導体・メモリ需要や同業株の動向としてプラス材料候補です。'
    : sentiment === 'NEGATIVE'
      ? '半導体・メモリ需要や同業株の動向としてリスク材料候補です。'
      : '業界環境の確認材料です。キオクシアへの直接影響は記事内容と市場反応を併せて確認します。';
  return { sentiment, importance, impact, tags: tags.length ? tags : ['Semiconductor'] };
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const queries = [
      'キオクシア OR NAND OR SSD',
      'SanDisk OR サンディスク OR Micron OR マイクロン NAND',
      'NVIDIA OR エヌビディア 半導体 AI メモリ',
    ];
    const batches = await Promise.all(queries.map((q) => fetchJapaneseNews(q).catch(() => [])));
    const seen = new Set<string>();
    const now = Date.now();
    const maxAgeMs = 5 * 24 * 60 * 60 * 1000;

    const items = batches.flat().map((item) => {
      const rawTitle = stripSourceSuffix(item.title);
      const published = item.pubDate ? Date.parse(item.pubDate) : NaN;
      return { ...item, rawTitle, published };
    }).filter((item) => {
      if (!item.rawTitle || !hasJapanese(item.rawTitle)) return false;
      if (Number.isFinite(item.published) && now - item.published > maxAgeMs) return false;
      const key = item.rawTitle.toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(key)) return false;
      seen.add(key);
      return /キオクシア|Kioxia|NAND|SSD|SanDisk|サンディスク|Micron|マイクロン|NVIDIA|エヌビディア|半導体|メモリ|AI/i.test(item.rawTitle);
    }).sort((a, b) => (Number.isFinite(b.published) ? b.published : 0) - (Number.isFinite(a.published) ? a.published : 0)).slice(0, 6);

    const news = items.map((item, index) => {
      const c = classify(item.rawTitle);
      return {
        id: `ja-news-${item.published || index}-${index}`,
        title: item.rawTitle,
        summary: '日本語ニュースソースの見出しを表示しています。',
        source: item.source,
        publishedAt: Number.isFinite(item.published)
          ? new Date(item.published).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) + ' JST'
          : '配信時刻不明',
        sentiment: c.sentiment,
        importance: c.importance,
        kioxiaImpact: c.impact,
        tags: c.tags,
        url: item.link,
        language: 'ja',
        feed: 'Google News 日本語RSS',
      };
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=900');
    return res.status(200).json({ news, source: 'Google News 日本語RSS', count: news.length, translated: false, nativeJapanese: true });
  } catch (error) {
    console.error('[Japanese industry news] failed:', error instanceof Error ? error.message : String(error));
    return res.status(502).json({ news: [], source: 'Google News 日本語RSS', count: 0, translated: false, nativeJapanese: true, error: '日本語ニュースを取得できませんでした' });
  }
}
