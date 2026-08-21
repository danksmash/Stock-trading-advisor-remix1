import React from 'react';
import { ShieldAlert, AlertTriangle, ArrowRight, ChevronRight, Zap, Target } from 'lucide-react';
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

export const SignalScoreCard: React.FC<SignalScoreCardProps> = ({
  signalInfo,
  scoreBreakdown,
  buyCandidates,
  chasingRisk,
  dropAssessment,
  onOpenBreakdown,
}) => {
  const getSignalBadgeColor = (signal: SignalType) => {
    switch (signal) {
      case 'STRONG BUY':
        return 'text-emerald-400 border-emerald-500/50 bg-emerald-950/30';
      case 'BUY':
        return 'text-green-400 border-green-500/50 bg-green-950/30';
      case 'WAIT':
        return 'text-amber-400 border-amber-500/50 bg-amber-950/30';
      case 'AVOID':
        return 'text-rose-500 border-rose-500/50 bg-rose-950/30';
      default:
        return 'text-gray-400 border-gray-700 bg-gray-900/40';
    }
  };

  const getScoreBarColor = (score: number) => {
    if (score >= 75) return 'bg-gradient-to-r from-emerald-600 to-green-400';
    if (score >= 45) return 'bg-gradient-to-r from-amber-600 to-yellow-400';
    return 'bg-gradient-to-r from-rose-600 to-red-400';
  };

  return (
    <div className="flex flex-col gap-2 h-full">
      {/* Main Signal Display Card */}
      <section
        id="signal-main-card"
        className="bg-[#161B22] border border-gray-800 rounded p-3 flex flex-col items-center justify-center relative overflow-hidden shadow-lg"
      >
        {/* Ambient indicator glow */}
        <div
          className={`absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-16 rounded-full blur-2xl opacity-20 pointer-events-none ${
            scoreBreakdown.total >= 75 ? 'bg-emerald-500' : scoreBreakdown.total >= 45 ? 'bg-amber-500' : 'bg-rose-500'
          }`}
        />

        <div className="flex items-center justify-between w-full mb-1">
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider flex items-center gap-1">
            <Zap className="w-3 h-3 text-yellow-400" />
            総合投資シグナル
          </span>
          <span className="text-[9px] text-gray-500 font-mono">100点満点ルール判定</span>
        </div>

        {/* Large Signal Text */}
        <div className="my-1 text-center">
          <div
            className={`text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight font-mono transition-transform duration-300 ${signalInfo.color}`}
          >
            {signalInfo.signal}
          </div>
          <div className="text-[11px] font-medium text-gray-300 mt-0.5">{signalInfo.label}</div>
        </div>

        {/* Safety Note when Data Unavailable */}
        {signalInfo.signal === 'DATA UNAVAILABLE' && (
          <div className="text-[10px] text-gray-400 bg-gray-900/80 px-2 py-1 rounded border border-gray-700/60 my-1 text-center">
            市場データ待機中のため推測値によるBUY判定は停止されています。
          </div>
        )}

        {/* Score Progress Bar */}
        <div className="w-full bg-gray-900 border border-gray-800 h-2.5 rounded-full overflow-hidden my-2">
          <div
            className={`h-full transition-all duration-700 ease-out ${getScoreBarColor(scoreBreakdown.total)}`}
            style={{ width: `${scoreBreakdown.total}%` }}
          />
        </div>

        <div className="flex justify-between items-center w-full px-1">
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-tight">SIGNAL SCORE</span>
          <div className="flex items-baseline gap-1">
            <span
              className={`text-lg font-black font-mono ${
                scoreBreakdown.total >= 75
                  ? 'text-green-400'
                  : scoreBreakdown.total >= 45
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {scoreBreakdown.total}
            </span>
            <span className="text-xs text-gray-500 font-mono">/ 100</span>
          </div>
        </div>
      </section>

      {/* Chasing Risk Warning Banner (if triggered) */}
      {chasingRisk.isHighRisk && (
        <div
          id="chasing-risk-banner"
          className="bg-amber-950/40 border border-amber-600/50 rounded p-2 text-amber-200 flex flex-col gap-1 text-[11px] animate-pulse"
        >
          <div className="flex items-center gap-1.5 font-bold text-amber-400">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span>⚠️ HIGH PRICE CHASING RISK（高値追い警戒）</span>
          </div>
          <p className="text-[10px] text-amber-200/90 leading-tight">
            {chasingRisk.recommendation}
          </p>
        </div>
      )}

      {/* Rapid Drop Classification (if triggered) */}
      {dropAssessment.isDrop && (
        <div
          id="drop-assessment-banner"
          className="bg-rose-950/40 border border-rose-600/50 rounded p-2 text-rose-200 flex flex-col gap-1 text-[11px]"
        >
          <div className="flex items-center gap-1.5 font-bold text-rose-400">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>【急落判定】{dropAssessment.reason}</span>
          </div>
          <p className="text-[10px] text-rose-200/90 leading-tight">
            {dropAssessment.analysis}
          </p>
        </div>
      )}

      {/* Technical Breakdown & Buy Candidates */}
      <section
        id="technical-breakdown-card"
        className="bg-[#161B22] border border-gray-800 rounded p-2.5 flex-1 flex flex-col justify-between"
      >
        <div>
          <div className="flex items-center justify-between mb-2 border-b border-gray-800 pb-1.5">
            <h2 className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
              <span>スコア構成（クリックで詳細）</span>
            </h2>
            <button
              onClick={onOpenBreakdown}
              className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center font-medium"
            >
              内訳 <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-1.5 cursor-pointer" onClick={onOpenBreakdown}>
            <div className="flex justify-between items-center text-xs py-0.5 px-1 hover:bg-gray-800/60 rounded">
              <span className="text-gray-400">キオクシアテクニカル</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-emerald-400 font-bold">{scoreBreakdown.technical}</span>
                <span className="text-gray-600 text-[10px]">/ 40</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs py-0.5 px-1 hover:bg-gray-800/60 rounded">
              <span className="text-gray-400">米国半導体市場 (SOX/NVDA)</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-emerald-400 font-bold">{scoreBreakdown.usSemi}</span>
                <span className="text-gray-600 text-[10px]">/ 25</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs py-0.5 px-1 hover:bg-gray-800/60 rounded">
              <span className="text-gray-400">AI・NAND/SSD市況</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-emerald-400 font-bold">{scoreBreakdown.aiMemory}</span>
                <span className="text-gray-600 text-[10px]">/ 15</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs py-0.5 px-1 hover:bg-gray-800/60 rounded">
              <span className="text-gray-400">日本市場 & 為替(USD/JPY)</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-emerald-400 font-bold">{scoreBreakdown.japanFx}</span>
                <span className="text-gray-600 text-[10px]">/ 10</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs py-0.5 px-1 hover:bg-gray-800/60 rounded">
              <span className="text-gray-400">ニュース & イベント環境</span>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-emerald-400 font-bold">{scoreBreakdown.news}</span>
                <span className="text-gray-600 text-[10px]">/ 10</span>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Target Buy Zones */}
        <div className="mt-3 pt-2 border-t border-gray-800 space-y-1.5">
          <div className="text-[10px] text-gray-400 uppercase font-bold flex items-center gap-1">
            <Target className="w-3 h-3 text-emerald-400" />
            <span>動的買い候補価格帯（VWAP/ATR算出）</span>
          </div>

          {/* Candidate 1 */}
          <div className="bg-emerald-950/20 border border-emerald-800/40 p-1.5 rounded">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-emerald-300 font-bold">第一買い候補（VWAP支持帯）</span>
              <span className="text-xs font-mono font-black text-emerald-400">
                {buyCandidates.primaryMin.toLocaleString()} 〜 {buyCandidates.primaryMax.toLocaleString()} 円
              </span>
            </div>
            <div className="text-[9px] text-gray-400 mt-0.5 truncate">{buyCandidates.primaryRationale}</div>
          </div>

          {/* Candidate 2 */}
          <div className="bg-blue-950/20 border border-blue-800/40 p-1.5 rounded">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-blue-300 font-bold">第二買い候補（20MA押し目帯）</span>
              <span className="text-xs font-mono font-black text-blue-400">
                {buyCandidates.secondaryMin.toLocaleString()} 〜 {buyCandidates.secondaryMax.toLocaleString()} 円
              </span>
            </div>
            <div className="text-[9px] text-gray-400 mt-0.5 truncate">{buyCandidates.secondaryRationale}</div>
          </div>
        </div>
      </section>
    </div>
  );
};
