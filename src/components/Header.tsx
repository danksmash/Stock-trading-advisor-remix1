import React from 'react';
import { RefreshCw, Bell, Briefcase, BarChart2, ShieldAlert, Database, Info } from 'lucide-react';
import { MarketRegime, KioxiaMarketData } from '../types';

interface HeaderProps {
  kioxia: KioxiaMarketData;
  marketRegime: { regime: MarketRegime; text: string; badgeClass: string };
  isRefreshing: boolean;
  onRefresh: () => void;
  onOpenPortfolio: () => void;
  onOpenBacktest: () => void;
  onOpenAlerts: () => void;
  onOpenBreakdown: () => void;
  onOpenDataSources: () => void;
  isLiveMode: boolean;
  onToggleLiveMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  kioxia,
  marketRegime,
  isRefreshing,
  onRefresh,
  onOpenPortfolio,
  onOpenBacktest,
  onOpenAlerts,
  onOpenBreakdown,
  onOpenDataSources,
  isLiveMode,
  onToggleLiveMode,
}) => {
  return (
    <header className="flex flex-wrap items-center justify-between px-3 py-2 bg-[#161B22] border-b border-gray-800 gap-2 shrink-0 select-none">
      {/* Brand & Stock Title */}
      <div className="flex items-center gap-3">
        <div className="bg-blue-600 px-2 py-0.5 rounded text-[11px] font-black tracking-widest text-white shadow-sm">
          KIOXIA SIGNAL
        </div>
        <div className="flex items-center gap-2">
          <h1 className="text-sm md:text-base font-bold text-gray-100 flex items-center gap-1.5">
            <span className="text-blue-400 font-mono">285A</span>
            <span>キオクシアホールディングス</span>
          </h1>
          <span className="text-[10px] text-gray-400 font-mono hidden sm:inline">
            (東証プライム / 半導体メモリ・NAND)
          </span>
        </div>

        {/* Live/Demo Mode Switcher */}
        <button
          onClick={onToggleLiveMode}
          title="データモード切替"
          className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-colors ${
            isLiveMode
              ? 'bg-emerald-950/60 text-emerald-400 border-emerald-700/60 hover:bg-emerald-900/60'
              : 'bg-red-950/40 text-red-400 border-red-800/50 hover:bg-red-900/40'
          }`}
        >
          {isLiveMode ? '● LIVE FEED' : 'DEMO DATA'}
        </button>
      </div>

      {/* Center / Right controls */}
      <div className="flex items-center gap-2 sm:gap-4 ml-auto">
        {/* Market Regime */}
        <div className="flex flex-col items-end">
          <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">Market Regime</span>
          <span className={`text-[11px] font-bold px-1.5 py-0.2 rounded ${marketRegime.badgeClass}`}>
            {marketRegime.text}
          </span>
        </div>

        {/* Last Updated */}
        <div className="hidden md:flex flex-col items-end">
          <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">Last Updated</span>
          <span className="text-xs font-mono text-gray-300">{kioxia.lastUpdated}</span>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-1 bg-[#0B0E11] p-0.5 rounded border border-gray-800">
          <button
            onClick={onOpenPortfolio}
            title="保有ポートフォリオ & セクター集中度"
            className="flex items-center gap-1 text-[11px] px-2 py-1 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            <Briefcase className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden lg:inline font-medium">保有管理</span>
          </button>

          <button
            onClick={onOpenBacktest}
            title="売買シグナル過去バックテスト検証"
            className="flex items-center gap-1 text-[11px] px-2 py-1 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline font-medium">バックテスト</span>
          </button>

          <button
            onClick={onOpenAlerts}
            title="株価・出来高アラート設定"
            className="flex items-center gap-1 text-[11px] px-2 py-1 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden lg:inline font-medium">アラート</span>
          </button>

          <button
            onClick={onOpenBreakdown}
            title="100点スコアの内訳詳細"
            className="flex items-center gap-1 text-[11px] px-2 py-1 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden lg:inline font-medium">判定根拠</span>
          </button>

          <button
            onClick={onOpenDataSources}
            title="データソースと接続状況"
            className="flex items-center gap-1 text-[11px] px-2 py-1 text-gray-300 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            <Database className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden lg:inline font-medium">ソース</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="データ手動更新"
            className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
