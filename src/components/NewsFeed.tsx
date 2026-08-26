import React from 'react';
import { Newspaper, ArrowUpRight, ArrowDownRight, Minus, ExternalLink } from 'lucide-react';
import { NewsItem, NewsSentiment } from '../types';
interface NewsFeedProps { news: NewsItem[]; }
const sentimentLabel: Record<NewsSentiment, string> = { POSITIVE: 'プラス材料', NEGATIVE: 'マイナス材料', NEUTRAL: '中立' };
const hasJapanese=(text:string)=>/[ぁ-んァ-ン一-龯]/.test(text);
export const NewsFeed: React.FC<NewsFeedProps> = ({ news }) => {
  const [translations, setTranslations] = React.useState<Record<string,string>>({});
  const [translationState,setTranslationState]=React.useState<'loading'|'ok'|'partial'|'error'>('loading');
  React.useEffect(() => {
    const items = news.slice(0,6);
    if (!items.length) { setTranslations({}); setTranslationState('ok'); return; }
    let cancelled = false;
    setTranslationState('loading');
    fetch('/api/translate-news', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({titles:items.map(i=>i.title)}) })
      .then(r => r.ok ? r.json() : Promise.reject(new Error(String(r.status))))
      .then(data => {
        if (cancelled || !Array.isArray(data?.translations)) return;
        const next:Record<string,string>={};
        let translatedCount=0;
        items.forEach((item,i)=>{ const value=data.translations[i]; if(typeof value==='string'&&value&&hasJapanese(value)){ next[item.id]=value; translatedCount++; } });
        setTranslations(next);
        setTranslationState(translatedCount===items.length?'ok':translatedCount>0?'partial':'error');
      })
      .catch(() => { if (!cancelled) { setTranslations({}); setTranslationState('error'); } });
    return () => { cancelled = true; };
  }, [news]);
  const getSentimentBadge = (sentiment: NewsSentiment) => {
    const common='text-[8px] font-bold border px-1.5 py-0.5 rounded flex items-center gap-0.5 whitespace-nowrap';
    if(sentiment==='POSITIVE') return <span className={`${common} bg-emerald-950/80 text-emerald-400 border-emerald-700/60`}><ArrowUpRight className="w-2.5 h-2.5" />{sentimentLabel[sentiment]}</span>;
    if(sentiment==='NEGATIVE') return <span className={`${common} bg-rose-950/80 text-rose-400 border-rose-700/60`}><ArrowDownRight className="w-2.5 h-2.5" />{sentimentLabel[sentiment]}</span>;
    return <span className={`${common} bg-gray-800 text-gray-300 border-gray-700`}><Minus className="w-2.5 h-2.5" />{sentimentLabel[sentiment]}</span>;
  };
  const statusText=translationState==='loading'?'翻訳中…':translationState==='ok'?'日本語翻訳済み':translationState==='partial'?'一部翻訳取得失敗':'翻訳取得失敗';
  return <section id="sector-news-feed" className="bg-[#161B22] border border-gray-800 rounded p-2.5 flex flex-col">
    <div className="flex flex-wrap items-start justify-between gap-2 mb-2 pb-1.5 border-b border-gray-800"><div className="flex items-start gap-1.5 min-w-0"><Newspaper className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" /><div><h2 className="text-[10px] font-bold text-gray-200 tracking-wide">半導体・NAND業界ニュース</h2><p className="text-[8px] text-gray-500 mt-0.5">原見出しを内容を変えず日本語に翻訳します。翻訳できない場合は英語原題であることを明示します。</p></div></div><span className={`text-[8px] font-mono ${translationState==='ok'?'text-emerald-400':translationState==='loading'?'text-cyan-400':'text-amber-400'}`}>{statusText}</span></div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-2">
      {news.length===0 && <div className="xl:col-span-3 rounded border border-gray-800 bg-[#0D1117] p-3 text-[10px] text-gray-400">最新ニュースを取得できませんでした。</div>}
      {news.slice(0,6).map(item => { const jp=translations[item.id]; const shown=jp||item.title; return <article key={item.id} className="bg-[#0D1117] p-2.5 rounded border border-gray-800/80 flex flex-col gap-1.5 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">{getSentimentBadge(item.sentiment)}<span className="text-[9px] font-mono text-gray-400 font-semibold break-words">{item.source}</span>{item.importance==='HIGH'&&<span className="text-[8px] bg-red-950/60 text-red-400 border border-red-800/40 px-1 rounded font-bold">重要</span>}<span className="text-[8px] font-mono text-gray-500 ml-auto">{item.publishedAt}</span></div>
        {!jp && translationState!=='loading' && <div className="text-[8px] text-amber-400">英語原題（翻訳取得失敗）</div>}
        <h3 className="text-xs font-bold text-gray-100 leading-relaxed break-words">{shown}</h3>
        {jp && <p className="text-[8px] text-gray-600 leading-snug">原題：{item.title}</p>}
        <div className="bg-[#161B22] p-2 rounded border border-gray-800 text-[9px] leading-relaxed"><span className="text-blue-400 font-bold">キオクシアへの見方：</span><span className="text-gray-300"> {item.kioxiaImpact}</span></div>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-0.5">{item.tags.map(t=><span key={t} className="text-[8px] font-mono bg-gray-900 text-gray-400 px-1.5 py-0.5 rounded border border-gray-800">#{t}</span>)}{item.url&&<a href={item.url} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[8px] text-blue-400 hover:text-blue-300">原記事を開く <ExternalLink className="w-2.5 h-2.5" /></a>}</div>
      </article>; })}
    </div>
    <p className="mt-2 text-[8px] text-gray-500 leading-relaxed">※ 日本語見出しは原見出しの自動翻訳です。翻訳に失敗した記事は英語原題として明示し、翻訳済みと誤表示しません。</p>
  </section>;
};
