import React from 'react';
import { History, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';
import { SimilarScenarioResult } from '../types';

interface SimilarScenarioCardProps {
  scenario: SimilarScenarioResult;
}

export const SimilarScenarioCard: React.FC<SimilarScenarioCardProps> = ({ scenario }) => {
  return (
    <section id="similar-scenario-card" className="bg-[#161B22] border border-gray-800 rounded p-2.5 flex flex-col">
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-800">
        <div className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-cyan-400" />
          <h2 className="text-[10px] uppercase font-bold text-gray-300 tracking-wider">
            過去類似局面の事後リターン検証（条件マッチング）
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 font-mono">
            類似合致サンプル: <strong className="text-cyan-400 font-bold">{scenario.sampleCount}件</strong>
          </span>
          {scenario.isSampleSufficient ? (
            <span className="text-[9px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-1.5 py-0.2 rounded font-medium">
              統計信頼性: 良好
            </span>
          ) : (
            <span className="text-[9px] bg-amber-950/60 text-amber-400 border border-amber-800/40 px-1.5 py-0.2 rounded font-medium">
              サンプル不足
            </span>
          )}
        </div>
      </div>

      {/* Match Condition Chips */}
      <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
        <span className="text-[9px] text-gray-500 font-bold uppercase">合致条件:</span>
        <span className="text-[9px] font-mono bg-[#0D1117] text-gray-300 px-1.5 py-0.5 rounded border border-gray-800">
          曜日: {scenario.matchConditions.day}
        </span>
        <span className="text-[9px] font-mono bg-[#0D1117] text-gray-300 px-1.5 py-0.5 rounded border border-gray-800">
          時間: {scenario.matchConditions.time}
        </span>
        <span className="text-[9px] font-mono bg-[#0D1117] text-emerald-400 px-1.5 py-0.5 rounded border border-gray-800">
          騰落: +{scenario.matchConditions.kioxiaGainPercent}%
        </span>
        <span className="text-[9px] font-mono bg-[#0D1117] text-yellow-400 px-1.5 py-0.5 rounded border border-gray-800">
          VWAP: {scenario.matchConditions.vwapRelation === 'ABOVE' ? '上抜け' : '下回り'}
        </span>
        <span className="text-[9px] font-mono bg-[#0D1117] text-blue-400 px-1.5 py-0.5 rounded border border-gray-800">
          出来高: +{scenario.matchConditions.volumeSpikeRatio.toFixed(0)}%
        </span>
        <span className="text-[9px] font-mono bg-[#0D1117] text-purple-400 px-1.5 py-0.5 rounded border border-gray-800">
          SOX: +{scenario.matchConditions.soxGainPercent}% / NVDA: +{scenario.matchConditions.nvdaGainPercent}%
        </span>
      </div>

      {/* Outcome Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* +30 min */}
        <div className="bg-[#0D1117] p-2 rounded border border-gray-800 flex flex-col justify-between">
          <div className="text-[10px] text-gray-400 uppercase font-mono font-semibold">エントリー 30分後</div>
          <div className="my-1">
            <span className="text-xl font-black font-mono text-emerald-400">
              +{scenario.outcomes.plus30m.avgReturn.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between text-[9px] text-gray-400 font-mono">
            <span>勝率 (上昇確率):</span>
            <strong className="text-white">{scenario.outcomes.plus30m.winRate}%</strong>
          </div>
        </div>

        {/* +60 min */}
        <div className="bg-[#0D1117] p-2 rounded border border-gray-800 flex flex-col justify-between">
          <div className="text-[10px] text-gray-400 uppercase font-mono font-semibold">エントリー 60分後</div>
          <div className="my-1">
            <span className="text-xl font-black font-mono text-emerald-400">
              +{scenario.outcomes.plus60m.avgReturn.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between text-[9px] text-gray-400 font-mono">
            <span>勝率 (上昇確率):</span>
            <strong className="text-white">{scenario.outcomes.plus60m.winRate}%</strong>
          </div>
        </div>

        {/* +120 min */}
        <div className="bg-[#0D1117] p-2 rounded border border-gray-800 flex flex-col justify-between">
          <div className="text-[10px] text-gray-400 uppercase font-mono font-semibold">エントリー 120分後</div>
          <div className="my-1">
            <span className="text-xl font-black font-mono text-emerald-400">
              +{scenario.outcomes.plus120m.avgReturn.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between text-[9px] text-gray-400 font-mono">
            <span>勝率 (上昇確率):</span>
            <strong className="text-white">{scenario.outcomes.plus120m.winRate}%</strong>
          </div>
        </div>

        {/* EOD (引け) */}
        <div className="bg-emerald-950/20 p-2 rounded border border-emerald-800/40 flex flex-col justify-between">
          <div className="text-[10px] text-emerald-300 uppercase font-mono font-bold">大引け時点 (15:30)</div>
          <div className="my-1">
            <span className="text-xl font-black font-mono text-emerald-400">
              +{scenario.outcomes.eod.avgReturn.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between text-[9px] text-emerald-200/80 font-mono">
            <span>勝率 (上昇確率):</span>
            <strong className="text-emerald-300 font-black">{scenario.outcomes.eod.winRate}%</strong>
          </div>
        </div>
      </div>
    </section>
  );
};
