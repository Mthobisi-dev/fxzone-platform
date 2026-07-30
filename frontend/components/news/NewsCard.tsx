'use client';

import React from 'react';
import { Card } from '../ui/Card';
import { SentimentBadge } from '../ai/SentimentBadge';
import { Calendar, Globe, Tag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NewsArticle {
  id: string;
  title: string;
  source: string;
  url?: string;
  summary: string;
  sentiment: string;
  sentimentScore: number;
  assets: string[];
  createdAt: string | Date;
}

interface NewsCardProps {
  article: NewsArticle;
  onSelect?: (article: NewsArticle) => void;
}

export function NewsCard({ article, onSelect }: NewsCardProps) {
  const publishedDate = new Date(article.createdAt);
  
  const timeAgo = () => {
    try {
      return formatDistanceToNow(publishedDate, { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  return (
    <Card 
      onClick={() => onSelect?.(article)}
      className="p-4 border border-zinc-850 bg-zinc-900/30 hover:bg-zinc-900/50 hover:border-zinc-700/50 transition-all duration-200 cursor-pointer flex flex-col justify-between h-full group"
    >
      <div>
        <div className="flex justify-between items-center gap-4 mb-2">
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
            <Globe size={11} className="text-zinc-500" />
            <span className="font-semibold text-zinc-300 group-hover:text-white transition-colors">{article.source}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar size={10} />
              {timeAgo()}
            </span>
          </div>
          <SentimentBadge sentiment={article.sentiment} />
        </div>

        <h3 className="text-sm font-semibold text-white leading-snug mb-2 group-hover:text-blue-400 transition-colors line-clamp-2">
          {article.title}
        </h3>

        <p className="text-xs text-zinc-400 line-clamp-3 mb-3 leading-relaxed">
          {article.summary}
        </p>
      </div>

      {article.assets && article.assets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-zinc-850/50 mt-auto">
          {article.assets.map((asset) => (
            <span
              key={asset}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-300 font-medium hover:bg-zinc-750 transition-colors"
            >
              <Tag size={8} className="text-blue-400" />
              {asset}
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}
