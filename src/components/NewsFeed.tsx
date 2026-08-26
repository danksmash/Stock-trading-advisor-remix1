import React from 'react';
import { Newspaper, ArrowUpRight, ArrowDownRight, Minus, ExternalLink } from 'lucide-react';
import { NewsItem, NewsSentiment } from '../types';

interface NewsFeedProps { news: NewsItem[]; }

const sentimentLabel: Record<NewsSentiment, string> = { POSITIVE: 'プラス材料', NEGATIVE: 'マイナス材料', NEUTRAL: '中立' };

function japaneseHeadlineSummary(item: NewsItem): string {
  const t = item.title.toLowerCase();
  const company = t.includes('nvidia') ? 'NVIDIA' : t.includes('sandisk') || t.includes('sndk') ? 'SanDisk' : t.includes('micron') ? 'Micron' : t.includes('kioxia') ? 'キオクシア' : '半導体・メモリー業界';
  if (t.includes('earning')) return `${company}の決算・業績が、AI需要や半導体株全体の先行きを測る材料として注目されています。`;
  if (t.includes('2tb') || t.includes('flash launch') || t.includes('new flash')) return `${company}の大容量フラッシュメモリー新製品に関するニュースです。NANDの高容量化とAI向けストレージ需要の動向に関係します。`;
  if (t.includes('upgrade') || t.includes('price target')) return `${company}に対するアナリスト評価・目標株価の変更に関するニュースです。同業メモリー株の投資家心理に波及する可能性があります。`;
  if (t.includes('demand') || t.includes('ai trade') || t.includes('ai ')) return `${company}とAI関連需要についてのニュースです。データセンター投資がNAND・SSD需要へ波及するかを見る材料です。`;
  if (t.includes('gain') || t.includes('rise') || t.includes('surge')) return `${company}の株価上昇または業績期待に関するニュースです。半導体・メモリー株への資金流入を確認する参考材料です。`;
  if (t.includes('fall') || t.includes('drop') || t.includes('risk') || t.includes('cut')) return `${company}の下落・業績懸念・リスクに関するニュースです。キオクシアを含む同業株への波及に注意が必要です。`;
  return `${company}に関する最新ニュースです。キオクシアとの関連は、NAND・SSD需要、AIデータセンター投資、同業株の値動きという観点から確認します。`;
}

export const NewsFeed: React.FC<NewsFeedProps> = ({ news }) => {
  const getSentimentBadge = (sentiment: NewsSentiment) => {
    const common = 'text-[8px] font-bold border px-1.5 py-0.5 rounded flex items-center gap-0.5 whitespace-nowrap';
    if (sentiment === 'POSITIVE') return <span className={`${common} bg-emerald-950/80 text-emerald-400 border-emerald-700/60`}><ArrowUpRight className="w-2.5 h-2.5" />{sentimentLabel[sentiment]}</span>;
    if (sentiment === 'NEGATIVE') return <span className={`${common} bg-rose-950/80 text-rose-400 border-rose-700/60`}><ArrowDownRight className="w-2.5 h-2.5" />{sentimentLabel[sentiment]}</span>;
    return <span className={`${common} bg-gray-800 text-gray-300 border-gray-700`}><Minus className="w-2.5 h-2.5" />{sentimentLabel[sentiment]}</span>;
  };

  return (
    <section id="sector-news-feed" className="bg-[#161B22] border border-gray-800 rounded p-2.5 flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2 pb-1.5 border-b border-gray-800">
        <div className="flex items-start gap-1.5 min-w-0"><Newspaper className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" /><div><h2 className="text-[10px] font-bold text-gray-200 tracking-wide">半導体・NAND業界ニュース（日本語要約）</h2><p className="text-[8px] text-gray-500 mt-0.5">最新見出しを日本語で要約し、キオクシアへの関連を整理しています。</p></div></div>
        <span className="text-[8px] text-gray-500 font-mono">自動分類・参考情報</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
        {news.length === 0 && <div className="xl:col-span-3 rounded border border-gray-800 bg-[#0D1117] p-3 text-[10px] text-gray-400">最新ニュースを取得できませんでした。古い固定記事や推測記事は代替表示しません。</div>}
        {news.slice(0, 6).map((item) => (
          <article key={item.id} className="bg-[#0D1117] p-2.5 rounded border border-gray-800/80 flex flex-col gap-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">{getSentimentBadge(item.sentiment)}<span className="text-[9px] font-mono text-gray-400 font-semibold break-words">{item.source}</span>{item.importance === 'HIGH' && <span className="text-[8px] bg-red-950/60 text-red-400 border border-red-800/40 px-1 rounded font-bold">重要</span>}<span className="text-[8px] font-mono text-gray-500 ml-auto">{item.publishedAt}</span></div>
            <h3 className="text-xs font-bold text-gray-100 leading-relaxed">{japaneseHeadlineSummary(item)}</h3>
            <p className="text-[9px] text-gray-500 leading-relaxed"><span className="font-bold text-gray-400">原題：</span>{item.title}</p>
            <div className="bg-[#161B22] p-2 rounded border border-gray-800 text-[9px] leading-relaxed"><span className="text-blue-400 font-bold">キオクシアへの見方：</span><span className="text-gray-300"> {item.kioxiaImpact}</span></div>
            <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-0.5">{item.tags.map((t) => <span key={t} className="text-[8px] font-mono bg-gray-900 text-gray-400 px-1.5 py-0.5 rounded border border-gray-800">#{t}</span>)}{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[8px] text-blue-400 hover:text-blue-300">原記事を開く <ExternalLink className="w-2.5 h-2.5" /></a>}</div>
          </article>
        ))}
      </div>
      <p className="mt-2 text-[8px] text-gray-500 leading-relaxed">※ 日本語要約と影響評価は速報見出しから自動生成した参考情報です。原記事を読まなくても概要を把握できる表示にしていますが、重要な売買判断では一次情報も併用してください。</p>
    </section>
  );
};
