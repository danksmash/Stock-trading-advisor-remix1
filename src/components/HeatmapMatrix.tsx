import React, { useState } from 'react';
import { getDayTimeHeatmap, getDayStats } from '../services/statisticsEngine';
import { DayTimeCell, DayStats } from '../types';
import { Calendar, Clock, BarChart3, HelpCircle } from 'lucide-react';

export const HeatmapMatrix: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'heatmap' | 'dayStats'>('heatmap');
  const [selectedCell, setSelectedCell] = useState<DayTimeCell | null>(null);

  const heatmapCells = getDayTimeHeatmap();
  const dayStats = getDayStats();

  const days: ('MON' | 'TUE' | 'WED' | 'THU' | 'FRI')[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  const timeSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '12:30', '13:00', '14:00', '14:30', '15:00'];

  // Current simulation slot: THU 10:00
  const currentDay = 'THU';
  const currentTimeSlot = '10:00';

  const getCellBg = (val: number) => {
    if (val >= 2.0) return 'bg-emerald-500 text-black font-black';
    if (val >= 1.0) return 'bg-emerald-600/80 text-white font-bold';
    if (val >= 0.5) return 'bg-emerald-700/60 text-emerald-100 font-semibold';
    if (val > 0) return 'bg-emerald-950/70 text-emerald-300';
    if (val === 0) return 'bg-[#161B22] text-gray-500';
    if (val > -0.5) return 'bg-rose-950/70 text-rose-300';
    if (val > -1.0) return 'bg-rose-800/70 text-rose-100 font-semibold';
    return 'bg-rose-600 text-white font-black';
  };

  return (
    <section id="day-time-heatmap-section" className="bg-[#161B22] border border-gray-800 rounded p-2.5 flex flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-1.5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-blue-400" />
          <h2 className="text-[10px] uppercase font-bold text-gray-300 tracking-wider">
            曜日 × 時間帯 統計分析（引けまでの平均リターン）
          </h2>
        </div>

        {/* Tab switch */}
        <div className="flex bg-[#0B0E11] p-0.5 rounded border border-gray-800 text-[10px]">
          <button
            onClick={() => setActiveTab('heatmap')}
            className={`px-2 py-0.5 rounded font-mono ${
              activeTab === 'heatmap' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            時間帯ヒートマップ
          </button>
          <button
            onClick={() => setActiveTab('dayStats')}
            className={`px-2 py-0.5 rounded font-mono ${
              activeTab === 'dayStats' ? 'bg-blue-600 text-white font-bold' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            曜日別詳細統計
          </button>
        </div>
      </div>

      {activeTab === 'heatmap' ? (
        <div className="flex flex-col gap-2">
          {/* Heatmap Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[560px] grid grid-cols-11 gap-0.5 bg-gray-900/60 p-1 rounded border border-gray-800 text-[10px] font-mono">
              {/* Header row */}
              <div className="bg-[#161B22] flex items-center justify-center p-1 text-gray-500 font-bold">曜日</div>
              {timeSlots.map((slot) => (
                <div
                  key={slot}
                  className={`bg-[#161B22] flex items-center justify-center p-1 text-gray-400 font-bold ${
                    slot === currentTimeSlot ? 'text-yellow-400 bg-yellow-950/30' : ''
                  }`}
                >
                  {slot}
                </div>
              ))}

              {/* Day rows */}
              {days.map((day) => (
                <React.Fragment key={day}>
                  <div
                    className={`bg-[#161B22] flex items-center justify-center p-1 font-bold ${
                      day === currentDay ? 'text-yellow-400 bg-yellow-950/30 border-l-2 border-yellow-400' : 'text-gray-300'
                    }`}
                  >
                    {day}
                  </div>
                  {timeSlots.map((slot) => {
                    const cell = heatmapCells.find((c) => c.day === day && c.timeSlot === slot);
                    const val = cell?.avgReturnToClose || 0;
                    const isCurrent = day === currentDay && slot === currentTimeSlot;

                    return (
                      <div
                        key={`${day}-${slot}`}
                        onClick={() => cell && setSelectedCell(cell)}
                        className={`p-1.5 flex flex-col items-center justify-center rounded-xs cursor-pointer transition-all hover:scale-105 hover:z-10 hover:shadow-md ${getCellBg(
                          val
                        )} ${isCurrent ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-[#0B0E11]' : ''}`}
                        title={`${day} ${slot}: 平均引けリターン ${val > 0 ? `+${val}` : val}% (勝率 ${cell?.winRate}%)`}
                      >
                        <span>{val > 0 ? `+${val.toFixed(1)}%` : val === 0 ? '0.0%' : `${val.toFixed(1)}%`}</span>
                        <span className="text-[8px] opacity-75">{cell?.winRate}%勝</span>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Footer Highlights & Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-gray-400 mt-1">
            <div className="flex items-center gap-1.5 text-yellow-400 font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>
                現在時間帯 [木曜 10:00]: 過去データ平均 <strong className="text-emerald-400">+1.2%</strong> / 勝率 <strong>68%</strong> の優位性局面
              </span>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-2 text-[9px] font-mono">
              <span className="text-gray-500">平均騰落:</span>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-emerald-500 rounded-xs"></div>
                <span>+2.0%+</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-emerald-700 rounded-xs"></div>
                <span>+0.5%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-[#161B22] border border-gray-700 rounded-xs"></div>
                <span>0%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-rose-600 rounded-xs"></div>
                <span>-1.0%-</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Day by Day Statistics Table */
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-mono text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 bg-[#0D1117]">
                <th className="p-1.5">曜日</th>
                <th className="p-1.5 text-right">平均リターン</th>
                <th className="p-1.5 text-right">勝率</th>
                <th className="p-1.5 text-right">寄り後30分</th>
                <th className="p-1.5 text-right">寄り後60分</th>
                <th className="p-1.5 text-right">前場リターン</th>
                <th className="p-1.5 text-right">後場リターン</th>
                <th className="p-1.5 text-right">平均出来高</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {dayStats.map((ds) => (
                <tr
                  key={ds.dayName}
                  className={`hover:bg-gray-800/40 ${ds.dayName.includes('木曜日') ? 'bg-yellow-950/20 text-yellow-300 font-bold' : 'text-gray-300'}`}
                >
                  <td className="p-1.5 font-bold">{ds.dayName}</td>
                  <td className={`p-1.5 text-right font-bold ${ds.avgReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {ds.avgReturn >= 0 ? `+${ds.avgReturn.toFixed(2)}%` : `${ds.avgReturn.toFixed(2)}%`}
                  </td>
                  <td className="p-1.5 text-right text-white font-bold">{ds.winRate}%</td>
                  <td className={`p-1.5 text-right ${ds.first30mReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {ds.first30mReturn >= 0 ? `+${ds.first30mReturn.toFixed(2)}%` : `${ds.first30mReturn.toFixed(2)}%`}
                  </td>
                  <td className={`p-1.5 text-right ${ds.first60mReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {ds.first60mReturn >= 0 ? `+${ds.first60mReturn.toFixed(2)}%` : `${ds.first60mReturn.toFixed(2)}%`}
                  </td>
                  <td className={`p-1.5 text-right ${ds.morningReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {ds.morningReturn >= 0 ? `+${ds.morningReturn.toFixed(2)}%` : `${ds.morningReturn.toFixed(2)}%`}
                  </td>
                  <td className={`p-1.5 text-right ${ds.afternoonReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {ds.afternoonReturn >= 0 ? `+${ds.afternoonReturn.toFixed(2)}%` : `${ds.afternoonReturn.toFixed(2)}%`}
                  </td>
                  <td className="p-1.5 text-right text-gray-400">{(ds.avgVolume / 10000).toFixed(0)}万株</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
