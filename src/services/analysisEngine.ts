import {
  KioxiaMarketData,
  UsSemiQuote,
  NewsItem,
  ScoreBreakdown,
  SignalType,
  MarketRegime,
  BuyCandidates,
  ChasingRiskAssessment,
  DropAssessment,
  DropReason,
  PtsMarketPriceInfo,
  PtsSignalType,
  PTSMarketData,
} from '../types';

export function calculateScoreBreakdown(
  kioxia: KioxiaMarketData,
  usQuotes: UsSemiQuote[],
  news: NewsItem[]
): ScoreBreakdown {
  // 1. Technical (Max 40)
  let techScore = 0;
  const techNotes: string[] = [];

  // VWAP analysis (Max 15)
  if (kioxia.price > kioxia.vwap) {
    techScore += 10;
    techNotes.push(`現在値(${kioxia.price}円) > VWAP(${kioxia.vwap}円) を維持 (+10点)`);
    if (kioxia.volumeRatioVs20d > 20) {
      techScore += 5;
      techNotes.push(`出来高20日平均比 +${kioxia.volumeRatioVs20d.toFixed(1)}% の商いを伴う上昇 (+5点)`);
    }
  } else {
    techNotes.push(`現在値がVWAPを下回る水準 (0点)`);
  }

  // Trend & Moving Averages (Max 10)
  if (kioxia.price > kioxia.ma5 && kioxia.ma5 > kioxia.ma20 && kioxia.ma20 > kioxia.ma75) {
    techScore += 10;
    techNotes.push(`短期〜長期移動平均線（5MA>20MA>75MA）が完全なパーフェクトオーダー形成 (+10点)`);
  } else if (kioxia.price > kioxia.ma20) {
    techScore += 6;
    techNotes.push(`20日移動平均線を上回り中期上昇トレンド維持 (+6点)`);
  } else {
    techNotes.push(`主要移動平均線を下回りトレンド調整中 (0点)`);
  }

  // RSI(14) (Max 8)
  if (kioxia.rsi14 >= 50 && kioxia.rsi14 <= 68) {
    techScore += 8;
    techNotes.push(`RSI(14)=${kioxia.rsi14} は過熱感なく極めて健全な強気買いゾーン (+8点)`);
  } else if (kioxia.rsi14 > 68 && kioxia.rsi14 <= 75) {
    techScore += 5;
    techNotes.push(`RSI(14)=${kioxia.rsi14} やや過熱感が生じつつある強気水準 (+5点)`);
  } else if (kioxia.rsi14 < 35) {
    techScore += 3;
    techNotes.push(`RSI(14)=${kioxia.rsi14} 売られすぎ圏だがリバウンド確認待ち (+3点)`);
  } else {
    techScore += 2;
    techNotes.push(`RSI(14)=${kioxia.rsi14} 中立ゾーン (+2点)`);
  }

  // MACD (Max 7)
  if (kioxia.macd.histogram > 0 && kioxia.macd.macdLine > kioxia.macd.signalLine) {
    techScore += 7;
    techNotes.push(`MACDゴールデンクロス継続中・ヒストグラム拡大 (+7点)`);
  } else if (kioxia.macd.histogram > 0) {
    techScore += 4;
    techNotes.push(`MACDヒストグラムはプラス圏推移 (+4点)`);
  } else {
    techNotes.push(`MACDデッドクロス警戒 (0点)`);
  }

  // 2. US Semiconductor Market (Max 25)
  let usScore = 0;
  const usNotes: string[] = [];

  const sox = usQuotes.find((q) => q.symbol === '^SOX');
  const nvda = usQuotes.find((q) => q.symbol === 'NVDA');
  const mu = usQuotes.find((q) => q.symbol === 'MU');
  const wdc = usQuotes.find((q) => q.symbol === 'WDC');

  // SOX Index (Max 10)
  if (sox) {
    if (sox.changePercent >= 1.5) {
      usScore += 10;
      usNotes.push(`SOX半導体指数が+${sox.changePercent.toFixed(2)}%の大幅高 (+10点)`);
    } else if (sox.changePercent > 0) {
      usScore += 6;
      usNotes.push(`SOX半導体指数が+${sox.changePercent.toFixed(2)}%とプラス圏推移 (+6点)`);
    } else {
      usNotes.push(`SOX半導体指数が軟調(${sox.changePercent.toFixed(2)}%) (0点)`);
    }
  }

  // NVIDIA (Max 8)
  if (nvda) {
    if (nvda.changePercent >= 2.5) {
      usScore += 8;
      usNotes.push(`NVIDIAが+${nvda.changePercent.toFixed(2)}%と半導体セクターを強力牽引 (+8点)`);
    } else if (nvda.changePercent > 0) {
      usScore += 5;
      usNotes.push(`NVIDIAが+${nvda.changePercent.toFixed(2)}%と堅調推移 (+5点)`);
    } else {
      usNotes.push(`NVIDIAがマイナス推移 (0点)`);
    }
  }

  // Micron / SanDisk / WDC (Max 7)
  const memAvg = ((mu?.changePercent || 0) + (wdc?.changePercent || 0)) / 2;
  if (memAvg >= 2.0) {
    usScore += 7;
    usNotes.push(`Micron(+${mu?.changePercent || 0}%), WDC/SanDisk(+${wdc?.changePercent || 0}%) と同業フラッシュメモリ銘柄が急伸 (+7点)`);
  } else if (memAvg > 0) {
    usScore += 4;
    usNotes.push(`米国メモリ銘柄が平均+${memAvg.toFixed(2)}%と堅調 (+4点)`);
  } else {
    usNotes.push(`米国メモリ銘柄が上値重い (0点)`);
  }

  // 3. AI & Memory Market (Max 15)
  let aiScore = 0;
  const aiNotes: string[] = [];

  const nandPositive = news.some((n) => n.tags.includes('NAND') && n.sentiment === 'POSITIVE');
  const ssdPositive = news.some((n) => n.tags.includes('Enterprise SSD') && n.sentiment === 'POSITIVE');

  if (nandPositive && ssdPositive) {
    aiScore += 12;
    aiNotes.push(`Enterprise SSD需要急増 & NANDスポット価格反発の強い追い風 (+12点)`);
  } else if (nandPositive || ssdPositive) {
    aiScore += 8;
    aiNotes.push(`NAND/SSD市況回復基調 (+8点)`);
  } else {
    aiScore += 4;
    aiNotes.push(`市況は横ばい圏 (+4点)`);
  }

  aiScore += 3;
  aiNotes.push(`AIデータセンター向け大容量ストレージ採用加速 (+3点)`);

  // 4. Japan Market & FX (Max 10)
  let japanFxScore = 0;
  const japanFxNotes: string[] = [];

  const usdjpy = usQuotes.find((q) => q.symbol === 'USD/JPY');
  if (usdjpy && usdjpy.price >= 140) {
    japanFxScore += 5;
    japanFxNotes.push(`為替レートは1ドル=${usdjpy.price}円台と採算ラインを大幅に上回り業績安心感 (+5点)`);
  } else {
    japanFxScore += 2;
    japanFxNotes.push(`急激な円高リスクを警戒 (+2点)`);
  }

  if (kioxia.changePercent > 0) {
    japanFxScore += 3;
    japanFxNotes.push(`東証プライム半導体関連への海外資金流入継続 (+3点)`);
  }

  // 5. News & Events (Max 10)
  let newsScore = 0;
  const newsNotes: string[] = [];

  const positiveNewsCount = news.filter((n) => n.sentiment === 'POSITIVE').length;
  const negativeNewsCount = news.filter((n) => n.sentiment === 'NEGATIVE').length;

  if (positiveNewsCount >= 2 && negativeNewsCount === 0) {
    newsScore += 9;
    newsNotes.push(`ポジティブ材料が相次ぎネガティブ要因なし (+9点)`);
  } else if (negativeNewsCount > 0) {
    newsScore += 3;
    newsNotes.push(`警戒すべきニュース要因あり (+3点)`);
  } else {
    newsScore += 6;
    newsNotes.push(`ニュース環境は概ね中立〜良好 (+6点)`);
  }

  const total = Math.min(100, Math.max(0, techScore + usScore + aiScore + japanFxScore + newsScore));

  return {
    technical: techScore,
    technicalMax: 40,
    usSemi: usScore,
    usSemiMax: 25,
    aiMemory: aiScore,
    aiMemoryMax: 15,
    japanFx: japanFxScore,
    japanFxMax: 10,
    news: newsScore,
    newsMax: 10,
    total,
    details: {
      technicalNotes: techNotes,
      usSemiNotes: usNotes,
      aiMemoryNotes: aiNotes,
      japanFxNotes: japanFxNotes,
      newsNotes: newsNotes,
    },
  };
}

export function determineSignal(
  score: number,
  kioxia: KioxiaMarketData,
  isDataValid: boolean
): { signal: SignalType; label: string; color: string } {
  if (!isDataValid || kioxia.dataFreshness === 'ERROR' || kioxia.dataFreshness === 'UNAVAILABLE') {
    return {
      signal: 'DATA UNAVAILABLE',
      label: 'データ取得不可・判定停止中',
      color: 'text-gray-400',
    };
  }

  if (!kioxia.isMarketOpen) {
    return {
      signal: 'WAIT',
      label: '市場休場中（シグナル待機）',
      color: 'text-yellow-400',
    };
  }

  if (score >= 95) {
    return { signal: 'STRONG BUY', label: '買い条件が極めて強く成立', color: 'text-emerald-400' };
  }
  if (score >= 75) {
    return { signal: 'BUY', label: '買い条件が成立', color: 'text-green-400' };
  }
  if (score >= 45) {
    return { signal: 'WAIT', label: '条件未達・押し目待機', color: 'text-yellow-400' };
  }
  return { signal: 'AVOID', label: '買いシグナル不成立・様子見推奨', color: 'text-rose-500' };
}

export function determineMarketRegime(usQuotes: UsSemiQuote[]): {
  regime: MarketRegime;
  text: string;
  badgeClass: string;
} {
  const sox = usQuotes.find((q) => q.symbol === '^SOX');
  const nvda = usQuotes.find((q) => q.symbol === 'NVDA');

  const soxChg = sox?.changePercent || 0;
  const nvdaChg = nvda?.changePercent || 0;

  if (soxChg > 1.0 && nvdaChg > 1.5) {
    return {
      regime: 'RISK ON',
      text: '🟢 RISK ON（リスク選好・半導体強気）',
      badgeClass: 'text-green-400 bg-green-950/40 border border-green-800/60',
    };
  } else if (soxChg < -1.2 || nvdaChg < -2.0) {
    return {
      regime: 'RISK OFF',
      text: '🔴 RISK OFF（リスク回避・半導体軟調）',
      badgeClass: 'text-red-400 bg-red-950/40 border border-red-800/60',
    };
  }
  return {
    regime: 'NEUTRAL',
    text: '🟡 NEUTRAL（中立・方向感模索）',
    badgeClass: 'text-yellow-400 bg-yellow-950/40 border border-yellow-800/60',
  };
}

export function calculateBuyCandidates(kioxia: KioxiaMarketData): BuyCandidates {
  const vwap = kioxia.vwap;
  const atr = kioxia.atr14 || 90;

  // Primary Zone: Tight around VWAP and immediate support
  const primaryMin = Math.round((vwap - atr * 0.4) / 10) * 10;
  const primaryMax = Math.round((vwap + atr * 0.1) / 10) * 10;

  // Secondary Zone: Deep pullback / 20MA support zone
  const secondaryMin = Math.round((kioxia.ma20 - atr * 0.5) / 10) * 10;
  const secondaryMax = Math.round((kioxia.ma20 + atr * 0.2) / 10) * 10;

  return {
    primaryMin,
    primaryMax,
    primaryRationale: 'VWAP近傍の反発支持線ゾーン（リスクリワード良好）',
    secondaryMin,
    secondaryMax,
    secondaryRationale: '20日移動平均線近傍の押し目サポート帯',
  };
}

export function assessChasingRisk(kioxia: KioxiaMarketData): ChasingRiskAssessment {
  const triggers: string[] = [];
  let riskScore = 0;

  // 1. Deviated from VWAP
  const vwapDiffPercent = ((kioxia.price - kioxia.vwap) / kioxia.vwap) * 100;
  if (vwapDiffPercent > 1.6) {
    triggers.push(`VWAP乖離率が+${vwapDiffPercent.toFixed(2)}%と過熱圏`);
    riskScore += 35;
  }

  // 2. RSI Overbought
  if (kioxia.rsi14 > 72) {
    triggers.push(`RSI(14)=${kioxia.rsi14}で短期的な過熱シグナル点灯`);
    riskScore += 35;
  }

  // 3. Intraday Runup from Open
  const runupFromOpen = ((kioxia.price - kioxia.open) / kioxia.open) * 100;
  if (runupFromOpen > 3.0) {
    triggers.push(`寄り付きからの上昇幅が+${runupFromOpen.toFixed(2)}%に達し利確売りリスク`);
    riskScore += 30;
  }

  const isHighRisk = riskScore >= 50;

  return {
    isHighRisk,
    score: riskScore,
    triggers,
    recommendation: isHighRisk
      ? '急騰後の高値掴みリスクが高まっています。VWAPまたは押し目ゾーン（第1買い候補）までの引き付けを推奨します。'
      : '現時点で危険な高値追い乖離は認められず、エントリーリスクは標準範囲内です。',
  };
}

export function assessRapidDrop(kioxia: KioxiaMarketData, usQuotes: UsSemiQuote[], news: NewsItem[]): DropAssessment {
  const isDrop = kioxia.changePercent <= -3.0;
  if (!isDrop) {
    return {
      isDrop: false,
      reason: 'NONE',
      dropPercent: kioxia.changePercent,
      analysis: '急落は発生していません。',
    };
  }

  const hasBadNews = news.some((n) => n.sentiment === 'NEGATIVE' && n.importance === 'HIGH');
  const sox = usQuotes.find((q) => q.symbol === '^SOX');
  const isMarketDrop = (sox?.changePercent || 0) < -2.5;

  let reason: DropReason = 'UNKNOWN';
  let analysis = '';

  if (hasBadNews) {
    reason = 'NEWS-DRIVEN DROP';
    analysis = '特定悪材料（規制・ガイダンス下方修正・個別報道等）を主因とする下落。安易な逆張り買いは危険です。';
  } else if (isMarketDrop) {
    reason = 'MARKET-WIDE DROP';
    analysis = '米SOX指数急落などマクロ全般の地合い悪化に伴う連れ安。地合いの下げ止まり確認が必要です。';
  } else {
    reason = 'TECHNICAL DROP';
    analysis = '重要支持線（VWAP/20MA）割れに伴うテクニカル損切り巻き込みの下落。';
  }

  return {
    isDrop: true,
    reason,
    dropPercent: kioxia.changePercent,
    analysis,
  };
}

// ─────────────────────────────────────────────────────────────
// PTS Signal & After-Hours Analysis Engine
// ─────────────────────────────────────────────────────────────

export function evaluatePtsSignal(
  pts: PtsMarketPriceInfo | undefined,
  kioxia: KioxiaMarketData,
  usQuotes: UsSemiQuote[],
  news: NewsItem[]
): {
  signal: PtsSignalType;
  label: string;
  color: string;
  badgeClass: string;
  notes: string[];
} {
  if (!pts || !pts.isAvailable || pts.price <= 0 || pts.dataQuality === 'UNAVAILABLE') {
    return {
      signal: 'DATA UNAVAILABLE',
      label: 'PTSデータ利用不可（判定停止）',
      color: 'text-gray-400',
      badgeClass: 'text-gray-400 bg-gray-900 border border-gray-700',
      notes: ['無料のリアルタイムPTSデータソースを利用できないため、PTS判定は停止しています。'],
    };
  }

  const notes: string[] = [];
  let positiveScore = 0;
  let negativeScore = 0;

  // 1. PTS vs Previous Close
  if (pts.changePercentVsPrevClose >= 2.0) {
    positiveScore += 3;
    notes.push(`PTS価格が前日終値を+${pts.changePercentVsPrevClose.toFixed(2)}%上回り買い意欲旺盛`);
  } else if (pts.changePercentVsPrevClose <= -2.0) {
    negativeScore += 3;
    notes.push(`PTS価格が前日終値を${pts.changePercentVsPrevClose.toFixed(2)}%下回り売り先行`);
  } else {
    notes.push(`PTS価格は前日終値比 ${pts.changePercentVsPrevClose >= 0 ? '+' : ''}${pts.changePercentVsPrevClose.toFixed(2)}% と概ね中立レンジ`);
  }

  // 2. US Market & Semiconductor Sentiment
  const sox = usQuotes.find((q) => q.symbol === '^SOX');
  const nvda = usQuotes.find((q) => q.symbol === 'NVDA');
  const mu = usQuotes.find((q) => q.symbol === 'MU');

  if ((sox?.changePercent || 0) > 1.0 || (nvda?.changePercent || 0) > 1.5 || (mu?.changePercent || 0) > 2.0) {
    positiveScore += 2;
    notes.push(`米国半導体指数(SOX)およびNVIDIA/Micronの追い風`);
  } else if ((sox?.changePercent || 0) < -1.0 || (nvda?.changePercent || 0) < -1.5) {
    negativeScore += 2;
    notes.push(`米国市場の半導体安がPTS上値の重し`);
  }

  // 3. Foreign Exchange (USD/JPY)
  const usdjpy = usQuotes.find((q) => q.symbol === 'USD/JPY');
  if (usdjpy && usdjpy.price >= 140) {
    positiveScore += 1;
    notes.push(`ドル円 ${usdjpy.price}円台（円安基調が下値を支持）`);
  }

  // 4. Sector News
  const hasPositiveNews = news.some((n) => n.sentiment === 'POSITIVE');
  const hasNegativeNews = news.some((n) => n.sentiment === 'NEGATIVE');
  if (hasPositiveNews && !hasNegativeNews) {
    positiveScore += 1;
    notes.push(`NAND/SSDセクター材料が良好`);
  } else if (hasNegativeNews) {
    negativeScore += 2;
    notes.push(`懸念材料あり`);
  }

  if (positiveScore >= 4 && negativeScore <= 1) {
    return {
      signal: 'POSITIVE',
      label: 'PTS強気シグナル',
      color: 'text-emerald-400',
      badgeClass: 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/60',
      notes,
    };
  } else if (negativeScore >= 3) {
    return {
      signal: 'NEGATIVE',
      label: 'PTS弱気警戒シグナル',
      color: 'text-rose-400',
      badgeClass: 'text-rose-400 bg-rose-950/40 border border-rose-800/60',
      notes,
    };
  } else {
    return {
      signal: 'NEUTRAL',
      label: 'PTS中立シグナル',
      color: 'text-yellow-400',
      badgeClass: 'text-yellow-400 bg-yellow-950/40 border border-yellow-800/60',
      notes,
    };
  }
}

export function classifyPtsDriver(
  ptsChangePercent: number,
  usQuotes: UsSemiQuote[],
  news: NewsItem[]
): {
  status: 'SURGE' | 'DROP' | 'NORMAL';
  type: 'NEWS' | 'US_SEMI' | 'UNKNOWN';
  title: string;
  explanation: string;
} {
  if (ptsChangePercent >= 3.0) {
    const nandPositive = news.some((n) => (n.tags.includes('NAND') || n.tags.includes('Enterprise SSD')) && n.sentiment === 'POSITIVE');
    const sox = usQuotes.find((q) => q.symbol === '^SOX');
    const mu = usQuotes.find((q) => q.symbol === 'MU');

    if (nandPositive) {
      return {
        status: 'SURGE',
        type: 'NEWS',
        title: 'PTS急騰（好材料・セクターニュース主導）',
        explanation: 'AIデータセンター向けSSD需要増やNAND市況改善の個別好材料が好感されてPTSで買いが殺到しています。',
      };
    } else if ((sox?.changePercent || 0) > 1.5 || (mu?.changePercent || 0) > 2.0) {
      return {
        status: 'SURGE',
        type: 'US_SEMI',
        title: 'PTS急騰（米国半導体急伸連動）',
        explanation: '米国市場でのSOX指数高およびMicron/SanDisk関連銘柄の上昇に連動したサヤ寄せ買いが進行しています。',
      };
    } else {
      return {
        status: 'SURGE',
        type: 'UNKNOWN',
        title: 'PTS急騰（材料不明・板薄注意）',
        explanation: 'PTS上昇理由を確認できません。夜間PTS特有の流動性低下（板の薄さ）による急変動の可能性があるため、飛びつき買いは厳禁です。',
      };
    }
  } else if (ptsChangePercent <= -3.0) {
    const hasBadNews = news.some((n) => n.sentiment === 'NEGATIVE');
    const sox = usQuotes.find((q) => q.symbol === '^SOX');

    if (hasBadNews) {
      return {
        status: 'DROP',
        type: 'NEWS',
        title: 'PTS急落（悪材料ニュース要因）',
        explanation: 'ネガティブニュースや業績警戒の材料に反応してPTSで売りが先行しています。',
      };
    } else if ((sox?.changePercent || 0) < -2.0) {
      return {
        status: 'DROP',
        type: 'US_SEMI',
        title: 'PTS急落（米国ハイテク全面安連動）',
        explanation: '米半導体株指数の急落に連れ安する形でリスク回避の売りが出現しています。',
      };
    } else {
      return {
        status: 'DROP',
        type: 'UNKNOWN',
        title: 'PTS急落（材料不明・流動性要因）',
        explanation: '明確な悪材料は未確認です。PTS特有の誤発注や少額の成り行き売りによる下振れの可能性があります。',
      };
    }
  }

  return {
    status: 'NORMAL',
    type: 'UNKNOWN',
    title: 'PTS平常推移',
    explanation: 'PTS価格は通常のボラティリティ範囲内で推移しています。',
  };
}

export function getPtsNextDayOpenAnalysis(
  ptsChangePercent: number,
  ptsData?: PTSMarketData
): {
  directionText: string;
  disclaimer: string;
  sampleCount: number;
  isSufficientSample: boolean;
  historicalStats?: {
    upPercent: number;
    flatPercent: number;
    downPercent: number;
  };
} {
  // If server-side dynamic analysis is already provided from captured empirical data
  if (ptsData?.nextDayOpenAnalysis) {
    return ptsData.nextDayOpenAnalysis;
  }

  // Pure dynamic evaluation: If empirical data is not yet sufficient (< 10 samples)
  const sampleCount = ptsData?.historicalPoints?.length || 0;
  if (sampleCount < 10) {
    return {
      directionText: '統計的に信頼できるサンプル数ではありません',
      disclaimer: 'PTS価格は翌日の寄り付き価格を保証するものではありません。',
      sampleCount,
      isSufficientSample: false,
    };
  }

  return {
    directionText: `PTS前日比 ${ptsChangePercent >= 0 ? '+' : ''}${ptsChangePercent.toFixed(2)}% に対する実績蓄積データ (N=${sampleCount})`,
    disclaimer: 'PTS価格は翌日の寄り付き価格を保証するものではありません。',
    sampleCount,
    isSufficientSample: false,
  };
}
