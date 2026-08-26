import React from 'react';
import { ShieldAlert, AlertTriangle, ChevronRight, Zap, Target, CheckCircle } from 'lucide-react';
import {
  SignalType,
  ScoreBreakdown,
  BuyCandidates,
  ChasingRiskAssessment,
  DropAssessment,
} from '../types';

interface SignalScoreCardProps {
  signalInfo: { signal: SignalType; label: string; color: string };
  scoreBreakdown: ScoreBreakdown;
  buyCandidates: BuyCandidates;
  chasingRisk: ChasingRiskAssessment;
  dropAssessment: DropAssessment;
  onOpenBreakdown: () => void;
}

export const SignalScoreCard: React.FC<SignalScoreCardProps> = ({ signalInfo, scoreBreakdown, buyCandidates, chasingRisk, dropAssessment, onOpenBreakdown }) => {
  const getScoreBarColor = (score: number) => score >= 75 ? 'bg-gradient-to-r from-emerald-600 to-green-400' : score >= 45 ? 'bg-gradient-to-r from-amber-600 to-yellow-400' : 'bg-gradient-to-r from-rose-600 to-red-400';
  const groups = [
    { label: 'キオクシアテクニカル', score: scoreBreakdown.technical, max: 40, notes: scoreBreakdown.details.technicalNotes },
    { label: '米国半導体市場 (SOX/NVDA)', score: scoreBreakdown.usSemi, max: 25, notes: scoreBreakdown.details.usSemiNotes },
    { label: 'AI・NAND/SSD市況', score: scoreBreakdown.aiMemory, max: 15, notes: scoreBreakdown.details.aiMemoryNotes },
    { label: '日本市場 & 為替(USD/JPY)', score: scoreBreakdown.japanFx, max: 10, notes: scoreBreakdown.details.japanFxNotes },
    { label: 'ニュース & イベント環境', score: scoreBreakdown.news, max: 10, notes: scoreBreakdown.details.newsNotes },
  ];

  return (
    <div className="flex flex-col gap-2 h-full">
      <section id="signal-main-card" className="bg-[#161B22] border border-gray-800 rounded p-3 flex flex-col items-center justify-center relative overflow-hidden shadow-lg">
        <div className={`absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-16 rounded-full blur-2xl opacity-20 pointer-events-none ${scoreBreakdown.total >= 75 ? 'bg-emerald-500' : scoreBreakdown.total >= 45 ? 'bg-amber-500' : 'bg-rose-500'}`} />
        <div className="flex items-center justify-between w-full mb-1"><span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-400" />総合投資シグナル</span><span className="text-[9px] text-gray-500 font-mono">100点満点ルール判定</span></div>
        <div className="my-1 text-center"><div className={`text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight font-mono ${signalInfo.color}`}>{signalInfo.signal}</div><div className="text-[11px] font-medium text-gray-300 mt-0.5">{signalInfo.label}</div></div>
        {signalInfo.signal === 'DATA UNAVAILABLE' && <div className="text-[10px] text-gray-400 bg-gray-900/80 px-2 py-1 rounded border border-gray-700/60 my-1 text-center">市場データ待機中のため推測値によるBUY判定は停止されています。</div>}
        <div className="w-full bg-gray-900 border border-gray-800 h-2.5 rounded-full overflow-hidden my-2"><div className={`h-full transition-all duration-700 ease-out ${getScoreBarColor(scoreBreakdown.total)}`} style={{ width: `${scoreBreakdown.total}%` }} /></div>
        <div className="flex justify-between items-center w-full px-1"><span className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">SIGNAL SCORE</span><div className="flex items-baseline gap-1"><span className={`text-lg font-black font-mono ${scoreBreakdown.total >= 75 ? 'text-green-400' : scoreBreakdown.total >= 45 ? 'text-amber-400' : 'text-rose-400'}`}>{scoreBreakdown.total}</span><span className="text-xs text-gray-500 font-mono">/ 100</span></div></div>
      </section>

      {chasingRisk.isHighRisk && <div id="chasing-risk-banner" className="bg-amber-950/40 border border-amber-600/50 rounded p-2 text-amber-200 flex flex-col gap-1 text-[11px]"><div className="flex items-center gap-1.5 font-bold text-amber-400"><ShieldAlert className="w-4 h-4 shrink-0" /><span>⚠️ HIGH PRICE CHASING RISK（高値追い警戒）</span></div><p className="text-[10px] text-amber-200/90 leading-tight">{chasingRisk.recommendation}</p></div>}
      {dropAssessment.isDrop && <div id="drop-assessment-banner" className="bg-rose-950/40 border border-rose-600/50 rounded p-2 text-rose-200 flex flex-col gap-1 text-[11px]"><div className="flex items-center gap-1.5 font-bold text-rose-400"><AlertTriangle className="w-4 h-4 shrink-0" /><span>【急落判定】{dropAssessment.reason}</span></div><p className="text-[10px] text-rose-200/90 leading-tight">{dropAssessment.analysis}</p></div>}

      <section id="technical-breakdown-card" className="bg-[#161B22] border border-gray-800 rounded p-2.5 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-2 border-b border-gray-800 pb-1.5"><h2 className="text-[10px] uppercase font-bold text-gray-400">スコア構成（クリックで詳細）</h2><button onClick={onOpenBreakdown} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center font-medium">内訳 <ChevronRight className="w-3 h-3" /></button></div>
        <div className="space-y-2 cursor-pointer" onClick={onOpenBreakdown}>
          {groups.map((group) => (
            <div key={group.label} className="rounded border border-gray-800/70 bg-[#0D1117]/55 px-2 py-1.5 hover:bg-gray-800/60">
              <div className="flex justify-between items-center text-xs gap-2"><span className="text-gray-300 font-semibold">{group.label}</span><div className="flex items-center gap-1.5 font-mono shrink-0"><span className="text-emerald-400 font-bold">{group.score}</span><span className="text-gray-600 text-[10px]">/ {group.max}</span></div></div>
              <div className="mt-1 space-y-0.5">
                {group.notes.slice(0, 3).map((note, i) => <div key={i} className="flex items-start gap-1 text-[9px] leading-snug text-gray-500"><CheckCircle className="w-2.5 h-2.5 text-gray-600 mt-0.5 shrink-0" /><span>{note}</span></div>)}
                {group.notes.length === 0 && <div className="text-[9px] text-gray-600">現在の加点・減点根拠はありません。</div>}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-2 border-t border-gray-800 space-y-1.5">
          <div className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1"><Target className="w-3 h-3 text-emerald-400" /><span>動的買い候補価格帯（VWAP/ATR算出）</span></div>
          <div className="bg-emerald-950/20 border border-emerald-800/40 p-1.5 rounded"><div className="flex flex-wrap justify-between items-center gap-1"><span className="text-[10px] text-emerald-300 font-bold">第一買い候補（VWAP支持帯）</span><span className="text-xs font-mono font-black text-emerald-400">{buyCandidates.primaryMin.toLocaleString()} 〜 {buyCandidates.primaryMax.toLocaleString()} 円</span></div><div className="text-[9px] text-gray-400 mt-0.5 leading-snug">{buyCandidates.primaryRationale}</div></div>
          <div className="bg-blue-950/20 border border-blue-800/40 p-1.5 rounded"><div className="flex flex-wrap justify-between items-center gap-1"><span className="text-[10px] text-blue-300 font-bold">第二買い候補（20MA押し目帯）</span><span className="text-xs font-mono font-black text-blue-400">{buyCandidates.secondaryMin.toLocaleString()} 〜 {buyCandidates.secondaryMax.toLocaleString()} 円</span></div><div className="text-[9px] text-gray-400 mt-0.5 leading-snug">{buyCandidates.secondaryRationale}</div></div>
        </div>
      </section>
    </div>
  );
};
