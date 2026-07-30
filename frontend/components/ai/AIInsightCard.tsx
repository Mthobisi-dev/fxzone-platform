'use client';

import React from 'react';
import { Card } from '../ui/Card';
import { SentimentBadge } from './SentimentBadge';
import { Brain, Cpu, TrendingUp, Sparkles } from 'lucide-react';

interface AIInsight {
  symbol: string;
  name: string;
  sentiment: string;
  confidence: number; // 0 to 100
  keyPoints: string[];
  lastUpdated: string;
}

interface AIInsightCardProps {
  insight: AIInsight;
  onViewDetails?: (symbol: string) => void;
}

export function AIInsightCard({ insight, onViewDetails }: AIInsightCardProps) {
  const getConfidenceColor = (score: number) => {
    if (score >= 75) return 'bg-emerald-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-rose-500';
  };

  return (
    <Card className="p-4 border border-zinc-850 bg-zinc-900/40 hover:border-purple-500/30 transition-all duration-300 relative overflow-hidden group">
      {/* Background Glow */}
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-purple-600/10 rounded-full blur-2xl group-hover:bg-purple-600/15 transition-all duration-300" />
      
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm font-bold text-white tracking-wide">{insight.symbol}</span>
            <span className="text-[10px] text-zinc-400 font-medium">/ {insight.name}</span>
          </div>
          <span className="text-[9px] text-zinc-500">{insight.lastUpdated}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <SentimentBadge sentiment={insight.sentiment} pulse />
        </div>
      </div>

      {/* Key Points */}
      <div className="space-y-2 mb-4">
        {insight.keyPoints.map((point, index) => (
          <div key={index} className="flex gap-2 items-start text-xs text-zinc-300 leading-relaxed">
            <span className="text-purple-400 shrink-0 mt-1.5 h-1 w-1 bg-purple-400 rounded-full" />
            <p>{point}</p>
          </div>
        ))}
      </div>

      {/* Confidence Meter */}
      <div className="pt-3 border-t border-zinc-850 flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex justify-between items-center text-[10px] text-zinc-400 mb-1">
            <span className="flex items-center gap-1">
              <Brain size={10} className="text-purple-400" /> Confidence Level
            </span>
            <span className="font-semibold text-zinc-200">{insight.confidence}%</span>
          </div>
          <div className="h-1.5 bg-zinc-850 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getConfidenceColor(insight.confidence)}`}
              style={{ width: `${insight.confidence}%` }}
            />
          </div>
        </div>

        {onViewDetails && (
          <button
            onClick={() => onViewDetails(insight.symbol)}
            className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-0.5 transition-colors border border-purple-500/20 px-2 py-1 rounded bg-purple-500/5 hover:bg-purple-500/10"
          >
            <span>Details</span>
          </button>
        )}
      </div>
    </Card>
  );
}
