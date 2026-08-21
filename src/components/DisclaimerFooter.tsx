import React from 'react';
import { AlertCircle, ShieldCheck } from 'lucide-react';

interface DisclaimerFooterProps {
  lastUpdated: string;
}

export const DisclaimerFooter: React.FC<DisclaimerFooterProps> = ({ lastUpdated }) => {
  return (
    <footer className="px-3 py-2 bg-[#0D1117] border-t border-gray-800 flex flex-col md:flex-row items-center justify-between gap-2 shrink-0 select-none text-[10px] text-gray-500 font-mono">
      {/* System metadata */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1 text-gray-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>KIOXIA SIGNAL Engine v2026.08</span>
        </span>
        <span className="hidden sm:inline">|</span>
        <span>タイムゾーン: Asia/Tokyo (JST)</span>
        <span className="hidden sm:inline">|</span>
        <span>最終同期: {lastUpdated}</span>
      </div>

      {/* Mandatory Investment Disclaimer */}
      <div className="text-center md:text-right text-[9.5px] text-gray-400 leading-tight max-w-2xl font-sans">
        <span className="text-amber-400 font-bold mr-1">【重要免責事項】</span>
        本アプリは市場データ・統計をもとに投資判断を支援する情報提供ツールであり、投資助言・利益保証・売買勧誘を行うものではありません。株式取引には元本割れリスクが伴います。最終的な売買判断は利用者ご自身の自己責任で行ってください。
      </div>
    </footer>
  );
};
