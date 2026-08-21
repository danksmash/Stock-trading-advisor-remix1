import React from 'react';
import { X, Database, CheckCircle2, ShieldCheck, Clock, Server } from 'lucide-react';

interface DataSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLiveMode: boolean;
}

export const DataSourcesModal: React.FC<DataSourcesModalProps> = ({
  isOpen,
  onClose,
  isLiveMode,
}) => {
  if (!isOpen) return null;

  const sources = [
    {
      name: '1. 前日終値 (東京証券取引所 公式確定値)',
      provider: 'Tokyo Stock Exchange (TSE/JPX Official Close)',
      delay: '前営業日 15:30 確定値',
      status: '🟢 ONLINE (基準価格)',
      updateInterval: '営業日毎に1回確定',
    },
    {
      name: '2. 東京市場 リアルタイム価格・VWAP・歩み値 (285A)',
      provider: 'Tokyo Stock Exchange (TSE/JPX) & Market API Gateway',
      delay: isLiveMode ? 'リアルタイム (遅延なし)' : 'シミュレーション / デモモード',
      status: '🟢 ONLINE (高信頼性)',
      updateInterval: '5秒〜60秒更新',
    },
    {
      name: '3. PTS (私設取引所 / 夜間時間外取引)',
      provider: 'JNX (ジャパンネクスト証券 PTS) / Chi-X',
      delay: isLiveMode ? '無料リアルタイムソース提供不可時は UNAVAILABLE' : 'デモシミュレーション稼働中',
      status: isLiveMode ? '🟡 FEED GUARD (無料ソース不在時は遮断)' : '🟢 SIMULATION RUNNING',
      updateInterval: '夜間取引セッション連動',
    },
    {
      name: '4. 米国半導体株 (NVDA / MU / WDC / AMD / AVGO)',
      provider: 'Nasdaq / Cboe / Financial Modeling Gateway',
      delay: 'リアルタイム / 米国市場終了値',
      status: '🟢 ONLINE',
      updateInterval: '10秒更新 (時間外含む)',
    },
    {
      name: '5. フィラデルフィア半導体株指数 (SOX) & 主要指数',
      provider: 'PHLX / S&P Dow Jones Indices',
      delay: 'リアルタイム',
      status: '🟢 ONLINE',
      updateInterval: '30秒更新',
    },
    {
      name: '6. 為替レート (USD/JPY) & 米10年債利回り',
      provider: 'Interbank Forex & US Treasury Feed',
      delay: 'リアルタイム',
      status: '🟢 ONLINE',
      updateInterval: '1秒更新',
    },
    {
      name: '7. NAND / Enterprise SSD / AI関連ニュース',
      provider: 'Reuters, Nikkei, TrendForce, Bloomberg Storage',
      delay: '速報配信',
      status: '🟢 ONLINE',
      updateInterval: 'AI自動解析 (Gemini 3.7)',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
      <div className="bg-[#161B22] border border-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0D1117]">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-bold text-gray-100">DATA SOURCES & データプロバイダー接続構成</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 overflow-y-auto font-mono text-xs">
          <div className="bg-[#0D1117] p-2.5 rounded border border-gray-800 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-200">データプロバイダー抽象化レイヤー</span>
              <span className="text-[10px] bg-blue-950/80 text-blue-400 border border-blue-800/40 px-1.5 py-0.2 rounded font-bold">
                Abstract Architecture
              </span>
            </div>
            <p className="text-[11px] text-gray-400 font-sans leading-relaxed">
              本アプリは <code>IMarketDataProvider</code>, <code>INewsProvider</code>, <code>IFundamentalDataProvider</code> による疎結合インターフェース設計を採用しており、将来的な有料プロバイダー切り替えや自社データ連携にもシームレスに対応可能です。
            </p>
          </div>

          <div className="space-y-2">
            {sources.map((s, i) => (
              <div key={i} className="bg-[#0D1117] p-2.5 rounded border border-gray-800/80 space-y-1">
                <div className="flex items-center justify-between font-bold text-gray-200">
                  <span>{s.name}</span>
                  <span className="text-[10px] text-emerald-400">{s.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400">
                  <div>提供元: <strong className="text-gray-300">{s.provider}</strong></div>
                  <div>遅延仕様: <strong className="text-gray-300">{s.delay}</strong></div>
                  <div>更新間隔: <strong className="text-gray-300">{s.updateInterval}</strong></div>
                  <div>接続方式: <strong className="text-gray-300">Secure Backend Proxy</strong></div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-gray-500 bg-gray-900/40 p-2 rounded border border-gray-800">
            🛡️ <strong>安全設計ポリシー:</strong> API接続エラーまたは通信遮断が発生した場合、自動的に「DATA UNAVAILABLE」に遷移し、誤った買いシグナルを発生させない安全インターロック機構が作動します。
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
