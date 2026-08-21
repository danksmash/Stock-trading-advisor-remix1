import React from 'react';
import { Bot, Sparkles, AlertCircle, RefreshCw, CheckCircle } from 'lucide-react';
import { AiCommentResult } from '../types';

interface AiCommentCardProps {
  aiComment: AiCommentResult | null;
  isLoading: boolean;
  onRefreshComment: () => void;
}

export const AiCommentCard: React.FC<AiCommentCardProps> = ({
  aiComment,
  isLoading,
  onRefreshComment,
}) => {
  return (
    <section id="ai-market-comment-card" className="bg-[#161B22] border border-gray-800 rounded p-2.5 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-gray-800">
          <div className="flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-purple-400" />
            <h2 className="text-[10px] uppercase font-bold text-gray-300 tracking-wider">
              AI MARKET COMMENT（客観的判断理由・リスク分析）
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {aiComment && (
              <span className="text-[9px] text-gray-500 font-mono">
                信頼度: <strong className="text-purple-400 font-bold">{aiComment.confidence}%</strong>
              </span>
            )}
            <button
              onClick={onRefreshComment}
              disabled={isLoading}
              className="text-[10px] text-gray-400 hover:text-purple-300 flex items-center gap-1 disabled:opacity-50"
              title="AIコメント再生成"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin text-purple-400' : ''}`} />
              <span className="hidden sm:inline">再分析</span>
            </button>
          </div>
        </div>

        {/* Comment Body */}
        {isLoading ? (
          <div className="py-4 flex items-center justify-center gap-2 text-xs text-gray-400">
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
            <span>AIが市場・テクニカルデータを統合分析中...</span>
          </div>
        ) : aiComment ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-200 leading-relaxed font-normal bg-[#0D1117] p-2 rounded border border-gray-800/80">
              "{aiComment.comment}"
            </p>

            {/* Rationale and Risks Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px]">
              {/* Positive Rationale */}
              <div className="bg-emerald-950/15 border border-emerald-800/30 p-1.5 rounded space-y-1">
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  判断根拠（プラス材料）
                </span>
                <ul className="space-y-0.5 text-gray-300 list-disc list-inside">
                  {aiComment.rationale.map((r, i) => (
                    <li key={i} className="truncate">{r}</li>
                  ))}
                </ul>
              </div>

              {/* Key Risks */}
              <div className="bg-amber-950/15 border border-amber-800/30 p-1.5 rounded space-y-1">
                <span className="text-amber-400 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 text-amber-400" />
                  留意すべきリスク要因
                </span>
                <ul className="space-y-0.5 text-gray-300 list-disc list-inside">
                  {aiComment.keyRisks.map((k, i) => (
                    <li key={i} className="truncate">{k}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-500 py-2 text-center">コメントデータなし</div>
        )}
      </div>

      <div className="mt-2 pt-1 border-t border-gray-800/60 flex justify-between items-center text-[9px] text-gray-500">
        <span>※ 本解説は定量的ルールと市場データに基づく客観要約です（利益保証・投資助言ではありません）。</span>
        <span className="font-mono">{aiComment?.generatedAt}</span>
      </div>
    </section>
  );
};
