'use client';

import React, { useState, useEffect } from 'react';
import { NewsCard } from './NewsCard';
import { Input } from '../ui/Input';
import { Search, Loader2, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { Modal } from '../ui/Modal';
import { SentimentBadge } from '../ai/SentimentBadge';

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

export function NewsFeed() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'forex' | 'stock' | 'crypto'>('all');
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);

  const fetchNews = async () => {
    setLoading(true);
    setError(null);
    try {
      // Endpoint is /api/news/feed
      const response = await api.get('/api/news/feed?limit=20');
      let items: any[] = [];
      if (Array.isArray(response)) {
        items = response;
      } else if (response && Array.isArray(response.items)) {
        items = response.items;
      }

      // Map backend database keys to frontend model keys
      const mapped = items.map((item: any) => ({
        id: item.id || item._id || String(Math.random()),
        title: item.title || '',
        source: item.source || 'Unknown',
        url: item.url || '#',
        summary: item.content || item.summary || '',
        sentiment: item.sentiment_label || item.sentiment || 'neutral',
        sentimentScore: item.sentiment_score !== undefined ? item.sentiment_score : (item.sentimentScore || 0),
        assets: item.asset_tags || item.assets || [],
        createdAt: item.published_at || item.createdAt || new Date(),
      }));
      setArticles(mapped);
    } catch (err) {
      console.error('Error fetching news:', err);
      setError('Could not retrieve latest news. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  const filteredArticles = articles.filter((article) => {
    // Search query filter
    const matchesSearch =
      article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      article.source.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (article.assets && Array.isArray(article.assets) && article.assets.some((asset) => asset.toLowerCase().includes(searchQuery.toLowerCase())));

    if (!matchesSearch) return false;

    // Category filter
    if (activeTab === 'all') return true;
    
    // We can check if any asset of that type is present in article assets
    // For simplicity, checking if tag equals type or matching general keywords
    if (!article.assets || !Array.isArray(article.assets)) return false;
    return article.assets.some((asset) => {
      const lowerAsset = asset.toLowerCase();
      if (activeTab === 'crypto') return lowerAsset.includes('btc') || lowerAsset.includes('eth') || lowerAsset.includes('sol') || lowerAsset.includes('usd') && (lowerAsset.includes('crypto') || lowerAsset.includes('coin'));
      if (activeTab === 'forex') return lowerAsset.includes('usd') || lowerAsset.includes('eur') || lowerAsset.includes('gbp') || lowerAsset.includes('jpy') || lowerAsset.includes('aud');
      if (activeTab === 'stock') return lowerAsset.includes('aapl') || lowerAsset.includes('tsla') || lowerAsset.includes('nvda') || lowerAsset.includes('meta') || lowerAsset.includes('goog');
      return false;
    });
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header Controls */}
      <div className="flex flex-col gap-3 mb-4 select-none">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white tracking-wide">Market Intelligence</h2>
          <button
            onClick={fetchNews}
            disabled={loading}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search news, symbols, assets..."
            className="w-full h-8 pl-9 pr-3 bg-zinc-900/50 text-xs border border-zinc-850 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-850 pb-1">
          {(['all', 'forex', 'stock', 'crypto'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-xs capitalize transition-colors border-b-2 -mb-[5px] font-medium ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Feed Container */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && articles.length === 0 ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : error && articles.length === 0 ? (
          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-center flex flex-col items-center gap-2">
            <AlertCircle className="text-rose-500" size={20} />
            <p className="text-xs text-rose-200">{error}</p>
            <button
              onClick={fetchNews}
              className="text-xs text-blue-400 font-semibold underline hover:text-blue-300"
            >
              Try Again
            </button>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div className="h-40 flex items-center justify-center border border-dashed border-zinc-850 rounded-xl bg-zinc-900/10">
            <p className="text-xs text-zinc-500 font-medium">No matching news found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filteredArticles.map((article) => (
              <NewsCard key={article.id} article={article} onSelect={setSelectedArticle} />
            ))}
          </div>
        )}
      </div>

      {/* Detailed Modal */}
      {selectedArticle && (
        <Modal 
          isOpen={!!selectedArticle} 
          onClose={() => setSelectedArticle(null)}
          title="Market News Detail"
        >
          <div className="space-y-4">
            <div className="flex justify-between items-start gap-4">
              <div>
                <span className="text-[10px] text-zinc-400 font-semibold tracking-wider uppercase block mb-1">
                  {selectedArticle.source}
                </span>
                <h2 className="text-lg font-bold text-white leading-snug">
                  {selectedArticle.title}
                </h2>
              </div>
              <SentimentBadge sentiment={selectedArticle.sentiment} pulse />
            </div>

            <div className="text-xs text-zinc-400 flex gap-2">
              <span>Published:</span>
              <span className="text-zinc-300 font-medium">
                {new Date(selectedArticle.createdAt).toLocaleString()}
              </span>
            </div>

            <p className="text-sm text-zinc-200 leading-relaxed bg-zinc-900/40 p-4 rounded-xl border border-zinc-850 whitespace-pre-wrap">
              {selectedArticle.summary}
            </p>

            <div className="flex justify-between items-center pt-2">
              <div className="flex flex-wrap gap-1">
                {selectedArticle.assets.map((asset) => (
                  <span 
                    key={asset} 
                    className="px-2 py-0.5 bg-zinc-800 text-[10px] text-zinc-300 rounded font-medium border border-zinc-700/50"
                  >
                    {asset}
                  </span>
                ))}
              </div>

              {selectedArticle.url && (
                <a
                  href={selectedArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 border border-blue-500/20 px-3 py-1.5 rounded-lg bg-blue-500/5 hover:bg-blue-500/10 transition-colors"
                >
                  Read Source Article
                </a>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
