import React, { useState, useEffect } from 'react';
import { X, Bell, Plus, Trash2, CheckCircle2, Shield } from 'lucide-react';
import { AlertRule } from '../types';

interface AlertSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  kioxiaPrice: number;
}

const DEFAULT_ALERTS: AlertRule[] = [
  { id: '1', type: 'SCORE_ABOVE', threshold: 75, enabled: true, label: '総合シグナルスコアが75点以上 (BUY成立)' },
  { id: '2', type: 'PRICE_BELOW', threshold: 5350, enabled: true, label: 'キオクシア株価が 5,350円 以下 (買い検討水準)' },
  { id: '3', type: 'VOLUME_SPIKE', threshold: 100, enabled: true, label: '出来高が20日平均比 +100% 以上' },
  { id: '4', type: 'NVDA_SPIKE', threshold: 3.0, enabled: true, label: 'NVIDIAが +3.0% 以上急伸' },
];

export const AlertSettingsModal: React.FC<AlertSettingsModalProps> = ({
  isOpen,
  onClose,
  kioxiaPrice,
}) => {
  const [alerts, setAlerts] = useState<AlertRule[]>(() => {
    const saved = localStorage.getItem('kioxia_app_alerts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return DEFAULT_ALERTS;
      }
    }
    return DEFAULT_ALERTS;
  });

  const [notificationPermission, setNotificationPermission] = useState<string>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, [isOpen]);

  useEffect(() => {
    localStorage.setItem('kioxia_app_alerts', JSON.stringify(alerts));
  }, [alerts]);

  if (!isOpen) return null;

  const requestNotification = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
    }
  };

  const toggleAlert = (id: string) => {
    setAlerts(alerts.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 animate-fade-in">
      <div className="bg-[#161B22] border border-gray-800 rounded-lg max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#0D1117]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-gray-100">リアルタイム アラート・通知設定</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Browser notification permission banner */}
          <div className="bg-[#0D1117] p-3 rounded border border-gray-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-gray-200">ブラウザ通知権限</div>
              <div className="text-[10px] text-gray-400">
                ステータス: <strong className="text-amber-400">{notificationPermission}</strong>
              </div>
            </div>
            {notificationPermission !== 'granted' && (
              <button
                onClick={requestNotification}
                className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-black font-bold text-xs rounded transition-colors"
              >
                通知を許可する
              </button>
            )}
          </div>

          {/* Alert rules list */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">監視中のアラート条件</span>
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-[#0D1117] p-2.5 rounded border border-gray-800 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={alert.enabled}
                    onChange={() => toggleAlert(alert.id)}
                    className="w-4 h-4 rounded accent-blue-600 bg-gray-800 border-gray-700 cursor-pointer"
                  />
                  <span className={alert.enabled ? 'text-gray-200 font-medium' : 'text-gray-500 line-through'}>
                    {alert.label}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    alert.enabled ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40' : 'bg-gray-800 text-gray-500'
                  }`}
                >
                  {alert.enabled ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-[#0D1117] border-t border-gray-800 flex justify-end">
          <button onClick={onClose} className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded">
            保存して閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
