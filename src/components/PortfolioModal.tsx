import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ShieldAlert, PieChart, TrendingDown, DollarSign } from 'lucide-react';
import { PortfolioPosition } from '../types';

interface PortfolioModalProps {
  isOpen: boolean;
  onClose: () => void;
  kioxiaCurrentPrice: number;
}

const DEFAULT_POSITIONS: PortfolioPosition[] = [
  {
    id: '1',
    symbol: '285A',
    name: 'キオクシアホールディングス',
    sector: '半導体 (NAND/SSD)',
    buyPrice: 5310,
    shares: 200,
    currentPrice: 5420,
    note: '寄り付き打診買い',
  },
  {
    id: '2',
    symbol: '6920',
    name: 'レーザーテック',
    sector: '半導体製造装置 (EUVマスク検査)',
    buyPrice: 26800,
    shares: 100,
    currentPrice: 27450,
    note: '中期ホールド',
  },
  {
    id: '3',
    symbol: '6857',
    name: 'アドバンテスト',
    sector: '半導体検査装置 (SoC/HBMテスター)',
    buyPrice: 8900,
    shares: 300,
    currentPrice: 9120,
    note: 'AIテスター需要',
  },
];

export const PortfolioModal: React.FC<PortfolioModalProps> = ({
  isOpen,
  onClose,
  kioxiaCurrentPrice,
}) => {
  const [positions, setPositions] = useState<PortfolioPosition[]>(() => {
    const saved = localStorage.getItem('kioxia_app_portfolio');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_POSITIONS;
      }
    }
    return DEFAULT_POSITIONS;
  });

  const [riskTolerancePercent, setRiskTolerancePercent] = useState<number>(() => {
    return Number(localStorage.getItem('kioxia_risk_tolerance') || 5);
  });

  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [newSector, setNewSector] = useState('半導体');
  const [newBuyPrice, setNewBuyPrice] = useState('');
  const [newShares, setNewShares] = useState('');

  // Update Kioxia's current price in positions
  useEffect(() => {
    setPositions((prev) =>
      prev.map((p) => (p.symbol === '285A' ? { ...p, currentPrice: kioxiaCurrentPrice } : p))
    );
  }, [kioxiaCurrentPrice]);

  useEffect(() => {
    localStorage.setItem('kioxia_app_portfolio', JSON.stringify(positions));
  }, [positions]);

  useEffect(() => {
    localStorage.setItem('kioxia_risk_tolerance', riskTolerancePercent.toString());
  }, [riskTolerancePercent]);

  if (!isOpen) return null;

  const handleAddPosition = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol || !newBuyPrice || !newShares) return;

    const newPos: PortfolioPosition = {
      id: Date.now().toString(),
      symbol: newSymbol.toUpperCase(),
      name: newName || newSymbol,
      sector: newSector,
      buyPrice: Number(newBuyPrice),
      shares: Number(newShares),
      currentPrice: Number(newBuyPrice),
    };

    setPositions([...positions, newPos]);
    setNewSymbol('');
    setNewName('');
    setNewBuyPrice('');
    setNewShares('');
  };

  const handleDelete = (id: string) => {
    setPositions(positions.filter((p) => p.id !== id));
  };

  // Calculations
  const totalCost = positions.reduce((acc, p) => acc + p.buyPrice * p.shares, 0);
  const totalValue = positions.reduce((acc, p) => acc + p.currentPrice * p.shares, 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  // Semiconductor Concentration Check
  const semiPositions = positions.filter((p) =>
    p.sector.includes('半導体') || ['285A', '6920', '6857', '8035', '6146', '7735', 'NVDA', 'MU'].includes(p.symbol)
  );
  const semiValue = semiPositions.reduce((acc, p) => acc + p.currentPrice * p.shares, 0);
  const semiRatio = totalValue > 0 ? (semiValue / totalValue) * 100 : 0;
  const isHighConcentration = semiPositions.length >= 2 && semiRatio >= 60;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
      <div className="bg-[#161B22] border border-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0D1117]">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-gray-100">ポートフォリオ管理 & セクター集中リスク分析</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Privacy Note */}
          <div className="text-[10px] text-gray-400 bg-gray-900/60 p-2 rounded border border-gray-800">
            🔒 <strong>プライバシー保護設計:</strong> 入力された保有データは外部サーバーへ送信されず、お使いのブラウザ内（localStorage）のみに安全に保存されます。
          </div>

          {/* Sector Concentration Warning */}
          {isHighConcentration && (
            <div className="bg-rose-950/40 border border-rose-600/60 rounded p-2.5 text-rose-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-400 flex items-center gap-1.5 text-xs">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  ⚠️ SECTOR CONCENTRATION WARNING（半導体セクター集中リスク: {semiRatio.toFixed(0)}%）
                </span>
                <span className="text-[10px] font-mono bg-rose-900/80 px-1.5 py-0.2 rounded font-bold">高リスク</span>
              </div>
              <p className="text-[11px] text-rose-200/90 leading-tight">
                キオクシア、レーザーテック、アドバンテストなど同業半導体セクターの比率が高まっています。米SOX指数急落や規制・市況悪化時に同時大幅下落を被るシステミックリスクにご留意ください。
              </p>
            </div>
          )}

          {/* Summary Stats Grid */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
            <div className="bg-[#0D1117] p-2 rounded border border-gray-800">
              <div className="text-[10px] text-gray-500 font-bold">評価総額</div>
              <div className="text-sm font-black text-white">{totalValue.toLocaleString()} 円</div>
            </div>
            <div className="bg-[#0D1117] p-2 rounded border border-gray-800">
              <div className="text-[10px] text-gray-500 font-bold">通算損益</div>
              <div className={`text-sm font-black ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalPnL >= 0 ? `+${totalPnL.toLocaleString()}` : totalPnL.toLocaleString()} 円 ({totalPnLPercent >= 0 ? `+${totalPnLPercent.toFixed(2)}` : totalPnLPercent.toFixed(2)}%)
              </div>
            </div>
            <div className="bg-[#0D1117] p-2 rounded border border-gray-800">
              <div className="text-[10px] text-gray-500 font-bold">半導体比率</div>
              <div className={`text-sm font-black ${semiRatio > 50 ? 'text-rose-400' : 'text-gray-200'}`}>
                {semiRatio.toFixed(1)}% ({semiPositions.length}銘柄)
              </div>
            </div>
          </div>

          {/* Risk Tolerance Setting */}
          <div className="bg-[#0D1117] p-2.5 rounded border border-gray-800 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-gray-300">個人の許容損失率（ロスカット基準）:</span>
              <div className="flex gap-1">
                {[3, 5, 7, 10].map((pct) => (
                  <button
                    key={pct}
                    onClick={() => setRiskTolerancePercent(pct)}
                    className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                      riskTolerancePercent === pct ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    -{pct}%
                  </button>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-gray-500">
              ※ 設定した許容損失ライン（-{riskTolerancePercent}%）を超過した場合にポジションリスクを強調表示します（投資助言ではありません）。
            </p>
          </div>

          {/* Positions Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 bg-[#0D1117]">
                  <th className="p-2">銘柄コード/名称</th>
                  <th className="p-2">セクター</th>
                  <th className="p-2 text-right">取得単価</th>
                  <th className="p-2 text-right">保有株数</th>
                  <th className="p-2 text-right">現在値</th>
                  <th className="p-2 text-right">損益</th>
                  <th className="p-2 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {positions.map((p) => {
                  const pnl = (p.currentPrice - p.buyPrice) * p.shares;
                  const pnlPct = ((p.currentPrice - p.buyPrice) / p.buyPrice) * 100;
                  const isStopHit = pnlPct <= -riskTolerancePercent;

                  return (
                    <tr key={p.id} className={`hover:bg-gray-800/40 ${isStopHit ? 'bg-rose-950/20' : ''}`}>
                      <td className="p-2">
                        <div className="font-bold text-gray-200">{p.symbol}</div>
                        <div className="text-[10px] text-gray-400">{p.name}</div>
                      </td>
                      <td className="p-2 text-[10px] text-gray-400">{p.sector}</td>
                      <td className="p-2 text-right">{p.buyPrice.toLocaleString()}円</td>
                      <td className="p-2 text-right">{p.shares.toLocaleString()}株</td>
                      <td className="p-2 text-right font-bold text-white">{p.currentPrice.toLocaleString()}円</td>
                      <td className={`p-2 text-right font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {pnl >= 0 ? `+${pnl.toLocaleString()}` : pnl.toLocaleString()}円
                        <div className="text-[9px]">({pnlPct >= 0 ? `+${pnlPct.toFixed(2)}` : pnlPct.toFixed(2)}%)</div>
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="text-gray-500 hover:text-rose-400 p-1 rounded hover:bg-gray-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add Position Form */}
          <form onSubmit={handleAddPosition} className="bg-[#0D1117] p-2.5 rounded border border-gray-800 space-y-2">
            <div className="text-[11px] font-bold text-gray-300">銘柄の追加</div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <input
                type="text"
                placeholder="コード (例: 285A)"
                value={newSymbol}
                onChange={(e) => setNewSymbol(e.target.value)}
                className="bg-[#161B22] border border-gray-700 rounded p-1.5 text-white font-mono placeholder:text-gray-600"
                required
              />
              <input
                type="text"
                placeholder="銘柄名"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="bg-[#161B22] border border-gray-700 rounded p-1.5 text-white placeholder:text-gray-600"
              />
              <input
                type="number"
                placeholder="取得価格 (円)"
                value={newBuyPrice}
                onChange={(e) => setNewBuyPrice(e.target.value)}
                className="bg-[#161B22] border border-gray-700 rounded p-1.5 text-white font-mono placeholder:text-gray-600"
                required
              />
              <input
                type="number"
                placeholder="株数"
                value={newShares}
                onChange={(e) => setNewShares(e.target.value)}
                className="bg-[#161B22] border border-gray-700 rounded p-1.5 text-white font-mono placeholder:text-gray-600"
                required
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold rounded p-1.5 flex items-center justify-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>追加</span>
              </button>
            </div>
          </form>
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
