import React from 'react';
import { X, CheckCircle, AlertCircle, Info, Layers, Cpu, Database, DollarSign, Newspaper } from 'lucide-react';
import { ScoreBreakdown } from '../types';

interface ScoreBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  breakdown: ScoreBreakdown;
}

export const ScoreBreakdownModal: React.FC<ScoreBreakdownModalProps> = ({
  isOpen,
  onClose,
  breakdown,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
      <div className="bg-[#161B22] border border-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0D1117]">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-gray-100">
              SIGNAL SCORE（100点満点）判定根拠と配点内訳
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-3.5 overflow-y-auto font-mono">
          {/* Total Score Summary */}
          <div className="bg-[#0D1117] p-3 rounded border border-gray-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-400 uppercase font-bold">現在の総合判定スコア</span>
              <div className="text-2xl font-black text-emerald-400 mt-0.5">{breakdown.total} / 100 点</div>
            </div>
            <div className="text-right text-[11px] text-gray-400">
              <div>BUY成立基準: <strong>75点以上</strong></div>
              <div>WAIT(様子見): <strong>45〜74点</strong></div>
              <div>AVOID(見送り): <strong>44点以下</strong></div>
            </div>
          </div>

          {/* 1. Technical (40) */}
          <div className="bg-[#0D1117] p-3 rounded border border-gray-800 space-y-1.5">
            <div className="flex justify-between items-center border-b border-gray-800 pb-1">
              <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                1. キオクシアテクニカル指標
              </span>
              <span className="text-xs font-black text-emerald-400">
                {breakdown.technical} / {breakdown.technicalMax} 点
              </span>
            </div>
            <ul className="text-[11px] text-gray-300 space-y-1 pl-2">
              {breakdown.details.technicalNotes.map((note, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 2. US Semiconductor (25) */}
          <div className="bg-[#0D1117] p-3 rounded border border-gray-800 space-y-1.5">
            <div className="flex justify-between items-center border-b border-gray-800 pb-1">
              <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-green-400" />
                2. 米国半導体市場 (SOX・NVDA・Micron)
              </span>
              <span className="text-xs font-black text-emerald-400">
                {breakdown.usSemi} / {breakdown.usSemiMax} 点
              </span>
            </div>
            <ul className="text-[11px] text-gray-300 space-y-1 pl-2">
              {breakdown.details.usSemiNotes.map((note, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. AI Memory & Storage (15) */}
          <div className="bg-[#0D1117] p-3 rounded border border-gray-800 space-y-1.5">
            <div className="flex justify-between items-center border-b border-gray-800 pb-1">
              <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-purple-400" />
                3. AI・NANDフラッシュ・SSD市況環境
              </span>
              <span className="text-xs font-black text-emerald-400">
                {breakdown.aiMemory} / {breakdown.aiMemoryMax} 点
              </span>
            </div>
            <ul className="text-[11px] text-gray-300 space-y-1 pl-2">
              {breakdown.details.aiMemoryNotes.map((note, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 4. Japan Market & FX (10) */}
          <div className="bg-[#0D1117] p-3 rounded border border-gray-800 space-y-1.5">
            <div className="flex justify-between items-center border-b border-gray-800 pb-1">
              <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-yellow-400" />
                4. 日本市場地合い & ドル円(USD/JPY)為替
              </span>
              <span className="text-xs font-black text-emerald-400">
                {breakdown.japanFx} / {breakdown.japanFxMax} 点
              </span>
            </div>
            <ul className="text-[11px] text-gray-300 space-y-1 pl-2">
              {breakdown.details.japanFxNotes.map((note, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 5. News & Events (10) */}
          <div className="bg-[#0D1117] p-3 rounded border border-gray-800 space-y-1.5">
            <div className="flex justify-between items-center border-b border-gray-800 pb-1">
              <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
                <Newspaper className="w-3.5 h-3.5 text-cyan-400" />
                5. ニュースセンチメント & イベント
              </span>
              <span className="text-xs font-black text-emerald-400">
                {breakdown.news} / {breakdown.newsMax} 点
              </span>
            </div>
            <ul className="text-[11px] text-gray-300 space-y-1 pl-2">
              {breakdown.details.newsNotes.map((note, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[#0D1117] border-t border-gray-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
