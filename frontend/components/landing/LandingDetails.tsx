import Link from 'next/link';
import { Activity, ArrowRight, BrainCircuit, CheckCircle2, Globe, Monitor, Newspaper, Users, Video } from 'lucide-react';
import { formatQuotePrice, LandingQuote, quoteStatus, tickerSymbols } from './market';

const features = [
  { icon: BrainCircuit, title: 'Gemini AI market intelligence', badge: 'AI assistant', description: 'Ask market questions and discuss research with the AI assistant in your terminal.', href: '/dashboard', action: 'Open the terminal' },
  { icon: Activity, title: 'Multi-asset market feeds', badge: 'Market data', description: 'Follow forex, crypto, stocks, and commodities with provider quotes and visible data freshness.', href: '#markets', action: 'Preview markets' },
  { icon: Newspaper, title: 'Market news aggregator', badge: 'News', description: 'Read market headlines alongside the assets you follow in your research workspace.', href: '/dashboard', action: 'Read market news' },
  { icon: Users, title: 'Social trader hub', badge: 'Community', description: 'Share analysis, discover other traders, follow their posts, and continue the conversation in chat.', href: '/feed', action: 'Explore the community' },
  { icon: Video, title: 'WebRTC live sessions', badge: 'Live sessions', description: 'Join market discussions with audio, video, screen sharing, and session chat.', href: '/sessions', action: 'Explore live sessions' },
  { icon: Monitor, title: 'Your trading workspace', badge: 'Adaptive', description: 'Bring charts, watchlists, and research together with Dark Terminal, Minimal Light, and Neon Cyber themes.', href: '/dashboard', action: 'Launch terminal' },
];

const highlights = [
  { title: 'Multi-asset', detail: 'Forex, crypto, stocks & commodities', icon: Globe },
  { title: 'Market updates', detail: 'Provider quotes with freshness labels', icon: Activity },
  { title: 'Gemini AI', detail: 'Assistance for your research workflow', icon: BrainCircuit },
  { title: 'Global access', detail: 'Web platform deployed on Vercel', icon: Monitor },
];

type Props = {
  quotes: LandingQuote[];
  loading: boolean;
  onInspect: (symbol: string) => void;
};

export function LandingMarkets({ quotes, loading, onInspect }: Props) {
  return (
    <section id="markets" aria-labelledby="landing-markets-title" className="fxzone-landing-panel my-8 min-w-0 scroll-mt-6 rounded-2xl border border-border p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="landing-markets-title" className="flex items-center gap-2 text-lg font-bold text-text"><Activity size={18} className="text-sky-400" /> Market feeds</h2>
          <p className="mt-1 text-sm text-text-muted">Select a symbol to open its chart and broker options.</p>
        </div>
        <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-sky-400">Launch terminal <ArrowRight size={16} /></Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3" role="group" aria-label="Market symbols">
        {tickerSymbols.map((symbol) => {
          const quote = quotes.find((item) => item.symbol === symbol);
          return (
            <button key={symbol} type="button" onClick={() => onInspect(symbol)} aria-label={`Trade or analyze ${symbol}`} className="fxzone-landing-subpanel flex w-44 shrink-0 flex-col items-start gap-2 rounded-xl border border-border p-4 text-left transition-colors hover:border-sky-400">
              <span className="flex w-full items-center justify-between gap-2"><span className="font-bold text-text">{symbol}</span><span className="text-xs text-text-muted">{loading ? 'Loading' : quoteStatus(quote)}</span></span>
              <span className="text-sm tabular-nums text-text">{quote ? formatQuotePrice(quote) : 'Quote unavailable'}</span>
              <span className={`text-xs font-semibold tabular-nums ${quote ? quote.change_pct >= 0 ? 'text-emerald-300' : 'text-rose-300' : 'text-text-muted'}`}>
                {quote ? `${quote.change_pct >= 0 ? '+' : ''}${quote.change_pct.toFixed(2)}% daily change` : 'Charts and broker options'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function LandingDetails({ quotes, loading, onInspect }: Props) {
  const preview = quotes.find((quote) => quote.symbol === 'BTCUSD');

  return (
    <>
      <section id="ai" aria-labelledby="landing-ai-title" className="scroll-mt-6 py-12 sm:py-20">
        <div className="fxzone-landing-panel grid min-w-0 gap-8 rounded-3xl border border-border p-5 sm:p-8 lg:grid-cols-2 lg:p-10">
          <div className="min-w-0">
            <p className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-400"><BrainCircuit size={18} /> Google Gemini AI assistant</p>
            <h2 id="landing-ai-title" className="text-3xl font-black tracking-tight text-text sm:text-4xl">Put your market research in context.</h2>
            <p className="mt-5 leading-7 text-text-muted">Bring questions about chart setups, market news, and risk to the AI assistant. Use your terminal to review the evidence behind your next decision.</p>
            <ul className="mt-6 space-y-3 text-sm text-text">
              {['Discuss technical indicators and market sentiment', 'Explore risk and position-sizing questions', 'Compare your research across timeframes'].map((item) => (
                <li key={item} className="flex items-start gap-2"><CheckCircle2 size={18} className="shrink-0 text-sky-400" />{item}</li>
              ))}
            </ul>
            <Link href="/dashboard" className="mt-7 inline-flex min-h-11 items-center gap-2 font-semibold text-sky-400">Open AI workspace <ArrowRight size={18} /></Link>
          </div>
          <div className="fxzone-landing-subpanel min-w-0 rounded-2xl border border-border p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
              <h3 className="font-bold text-text">BTCUSD research preview</h3>
              <span className="text-xs font-semibold text-text-muted">{loading ? 'Loading' : quoteStatus(preview)}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-text-muted">Quote context for a research conversation. This preview is not an AI-generated trading signal.</p>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><dt className="text-text-muted">Provider price</dt><dd className="font-semibold tabular-nums text-text">{preview ? formatQuotePrice(preview) : 'Unavailable'}</dd></div>
              <div className="flex flex-wrap justify-between gap-2"><dt className="text-text-muted">Daily price change</dt><dd className="font-semibold tabular-nums text-text">{preview ? `${preview.change_pct >= 0 ? '+' : ''}${preview.change_pct.toFixed(2)}%` : 'Unavailable'}</dd></div>
              <div className="flex flex-wrap justify-between gap-2"><dt className="text-text-muted">RSI / EMA / risk score</dt><dd className="text-text">Not available in this preview</dd></div>
            </dl>
            <div className="mt-5 rounded-xl border border-border p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">Example question</p>
              <p className="mt-2 text-sm leading-6 text-text">What price history and risk factors should I review before evaluating this setup?</p>
            </div>
            <button type="button" onClick={() => onInspect('BTCUSD')} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-text transition-colors hover:border-sky-400">Inspect setup (BTCUSD) <ArrowRight size={16} /></button>
            <p className="mt-4 text-xs leading-5 text-text-muted">AI analysis is informational only. Verify its output; it is not financial advice.</p>
          </div>
        </div>
      </section>

      <section id="features" aria-labelledby="landing-features-title" className="scroll-mt-6 pb-12 sm:pb-20">
        <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-12">
          <p className="text-sm font-bold uppercase tracking-widest text-sky-400">The complete workspace</p>
          <h2 id="landing-features-title" className="mt-4 text-3xl font-black tracking-tight text-text sm:text-4xl">Market intelligence meets community.</h2>
          <p className="mt-4 leading-7 text-text-muted">Research, follow the news, share analysis, and connect with other traders in one place.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
          {features.map(({ icon: Icon, title, badge, description, href, action }) => (
            <article key={title} className="fxzone-landing-panel flex min-w-0 flex-col rounded-2xl border border-border p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><Icon size={26} className="text-sky-400" /><span className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-text-muted">{badge}</span></div>
              <h3 className="text-lg font-bold text-text">{title}</h3>
              <p className="mb-6 mt-3 text-sm leading-6 text-text-muted">{description}</p>
              <Link href={href} className="mt-auto inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-sky-400">{action}<ArrowRight size={16} /></Link>
            </article>
          ))}
        </div>
      </section>

      <section id="stats" aria-labelledby="landing-platform-title" className="scroll-mt-6 border-y border-border py-10 sm:py-12">
        <h2 id="landing-platform-title" className="mb-8 text-center text-xl font-bold text-text">Built for your market workflow</h2>
        <div className="grid gap-7 min-[390px]:grid-cols-2 lg:grid-cols-4">
          {highlights.map(({ title, detail, icon: Icon }) => (
            <div key={title} className="min-w-0 text-center"><Icon size={24} className="mx-auto mb-3 text-sky-400" /><p className="text-xl font-bold text-text">{title}</p><p className="mt-2 text-sm leading-6 text-text-muted">{detail}</p></div>
          ))}
        </div>
      </section>
    </>
  );
}
