import React from 'react';
import { Newspaper, Tag, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { NewsItem, NewsSentiment } from '../types';

interface NewsFeedProps {
  news: NewsItem[];
}

export const NewsFeed: React.FC<NewsFeedProps> = ({ news }) => {
  const getSentimentBadge = (sentiment: NewsSentiment) => {
    switch (sentiment) {
      case 'POSITIVE':
        return (
          <span className="text-[8px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-700/60 px-1.5 py-0.2 rounded flex items-center gap-0.5">
            <ArrowUpRight className="w-2.5 h-2.5" />
            POSITIVE
          </span>
        );
      case 'NEGATIVE':
        return (
          <span className="text-[8px] font-bold bg-rose-950/80 text-rose-400 border border-rose-700/60 px-1.5 py-0.2 rounded flex items-center gap-0.5">
            <ArrowDownRight className="w-2.5 h-2.5" />
            NEGATIVE
          </span>
        );
      default:
        return (
          <span className="text-[8px] font-bold bg-gray-800 text-gray-300 border border-gray-700 px-1.5 py-0.2 rounded flex items-center gap-0.5">
            <Minus className="w-2.5 h-2.5" />
            NEUTRAL
          </span>
        );
    }
  };

  return (
    <section id="sector-news-feed" className="bg-[#161B22] border border-gray-800 rounded p-2.5 flex flex-col">
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-800">
        <div className="flex items-center gap-1.5">
          <Newspaper className="w-3.5 h-3.5 text-blue-400" />
          <h2 className="text-[10px] uppercase font-bold text-gray-300 tracking-wider">
            NAND / Enterprise SSD / AI関連ニュース & 影響評価
          </h2>
        </div>
        <span className="text-[9px] text-gray-500 font-mono">AI自動センチメント分類</span>
      </div>

      <div className="space-y-2">
        {news.length === 0 && (
          <div className="rounded border border-gray-800 bg-[#0D1117] p-3 text-[10px] text-gray-400">
            最新ニュースを取得できませんでした。固定記事による代替表示は行いません。
          </div>
        )}
        {news.slice(0, 3).map((item) => (
          <div
            key={item.id}
            className="bg-[#0D1117] p-2 rounded border border-gray-800/80 hover:border-gray-700 transition-colors"
          >
            {/* Header tags */}
            <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
              <div className="flex items-center gap-1.5">
                {getSentimentBadge(item.sentiment)}
                <span className="text-[9px] font-mono text-gray-400 font-semibold">{item.source}</span>
                {item.importance === 'HIGH' && (
                  <span className="text-[8px] bg-red-950/60 text-red-400 border border-red-800/40 px-1 rounded font-bold">
                    重要
                  </span>
                )}
              </div>
              <span className="text-[9px] font-mono text-gray-500">{item.publishedAt}</span>
            </div>

            {/* Title & Summary */}
            <h3 className="text-xs font-bold text-gray-100 mb-0.5 leading-snug">
              {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="hover:text-blue-300">{item.title}</a> : item.title}
            </h3>
            <p className="text-[10px] text-gray-400 leading-normal mb-1.5">{item.summary}</p>

            {/* Specific Kioxia Impact */}
            <div className="bg-[#161B22] p-1.5 rounded border border-gray-800 flex items-start gap-1.5 text-[9px]">
              <span className="text-blue-400 font-bold shrink-0">キオクシアへの影響:</span>
              <span className="text-gray-300">{item.kioxiaImpact}</span>
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {item.tags.map((t) => (
                <span
                  key={t}
                  className="text-[8px] font-mono bg-gray-900 text-gray-400 px-1.5 py-0.2 rounded border border-gray-800"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
