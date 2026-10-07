'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Github,
  Instagram,
  Linkedin,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { LandingDetails, LandingMarkets } from '@/components/landing/LandingDetails';
import { featuredSymbols, formatQuotePrice, isLandingQuote, LandingQuote, landingSymbols } from '@/components/landing/market';
import { TradeActionModal } from '@/components/trading/TradeActionModal';

const socialLinks = [
  { href: 'https://www.instagram.com/it.is_jack', label: 'Instagram', icon: Instagram },
  { href: 'https://github.com/Mthobisi-dev', label: 'GitHub', icon: Github },
  { href: 'https://www.linkedin.com/in/mthobisi-mzimela-136835354', label: 'LinkedIn', icon: Linkedin },
];

export default function LandingPage() {
  const [quotes, setQuotes] = useState<LandingQuote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSD');

  useEffect(() => {
    let active = true;

    const loadQuotes = async () => {
      try {
        const response = await fetch(`/api/market/prices?symbols=${landingSymbols.join(',')}`, {
          cache: 'no-store',
        });
        if (!response.ok) return;

        const data: unknown = await response.json();
        const values = Array.isArray(data)
          ? data
          : data && typeof data === 'object'
            ? Object.values(data)
            : [];

        if (active) setQuotes(values.filter(isLandingQuote));
      } catch {
        // The UI represents unavailable data instead of inventing market quotes.
      } finally {
        if (active) setLoadingQuotes(false);
      }
    };

    void loadQuotes();
    const interval = window.setInterval(() => void loadQuotes(), 30_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const marketPreview = useMemo(
    () => featuredSymbols
      .map((symbol) => quotes.find((quote) => quote.symbol === symbol))
      .filter((quote): quote is LandingQuote => Boolean(quote)),
    [quotes],
  );

  const inspectSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
    setTradeModalOpen(true);
  };

  const marketStatus = loadingQuotes
    ? 'Loading'
    : marketPreview.some((quote) => quote.freshness === 'live')
      ? 'Live'
      : marketPreview.length > 0
        ? 'Delayed'
        : 'Unavailable';

  return (
    <main className="fxzone-landing relative min-h-screen overflow-hidden bg-[var(--color-background)] text-slate-100">
      <TradeActionModal isOpen={tradeModalOpen} onClose={() => setTradeModalOpen(false)} symbol={selectedSymbol} />
      <div className="fxzone-landing-backdrop pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-x-0 top-[28rem] h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-3 pb-9 pt-3 sm:px-6 sm:pb-12 sm:pt-5 lg:px-10">
        <header className="fxzone-landing-nav flex min-h-16 items-center justify-between rounded-xl border border-white/10 bg-slate-950/45 px-3 shadow-2xl shadow-sky-950/25 backdrop-blur-xl sm:min-h-20 sm:rounded-2xl sm:px-7">
          <Link href="/" className="flex items-center gap-3" aria-label="FxZone home">
            <Image src="/fxzone-logo.jpg" alt="" width={36} height={36} className="h-8 w-8 rounded-lg border border-border object-cover sm:h-9 sm:w-9" />
            <span className="text-xl font-black tracking-tight text-white sm:text-3xl">Fx<span className="text-sky-400">Zone</span></span>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <Link href="/login" className="hidden rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-sky-300/60 hover:bg-white/5 min-[390px]:inline-flex sm:px-5">Log in</Link>
            <Link href="/register" className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400 sm:rounded-xl sm:px-5 sm:text-sm"><span className="sm:hidden">Join free</span><span className="hidden sm:inline">Get started</span></Link>
          </div>
        </header>

        <section id="home" className="grid items-center gap-9 py-12 sm:gap-12 sm:py-20 lg:min-h-[650px] lg:grid-cols-[0.9fr_1.1fr] lg:py-28">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
            <div className="mb-6 inline-flex max-w-full items-center gap-2 rounded-full border border-sky-300/15 bg-sky-400/10 px-3 py-2 text-xs font-semibold leading-5 text-sky-100 shadow-lg shadow-sky-950/30 sm:mb-8 sm:gap-3 sm:px-4">
              <Sparkles size={15} className="text-sky-300" />
              <span>Market research built for modern traders</span>
            </div>
            <p className="mb-3 text-3xl font-black tracking-tight sm:text-5xl">Fx<span className="text-sky-400">Zone</span></p>
            <h1 className="max-w-xl text-3xl font-black leading-[1.08] tracking-tight text-white min-[390px]:text-4xl sm:text-5xl lg:text-6xl">
              Analyze markets.<br />
              Understand signals.<br />
              <span className="text-sky-400">Trade with confidence.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-slate-300 sm:mt-7 sm:text-lg sm:leading-7">
              Bring live market context, structured research, and an active trading community into one focused workspace.
            </p>
            <div className="mt-7 flex flex-col gap-3 min-[390px]:flex-row sm:mt-9">
              <Link href="/register" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-3 font-bold text-white shadow-xl shadow-sky-500/20 transition hover:bg-sky-400 min-[390px]:w-auto sm:rounded-2xl sm:px-6 sm:py-3.5">
                Get started free <ArrowRight size={18} />
              </Link>
              <Link href="/dashboard" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:border-sky-300/60 hover:bg-white/5 min-[390px]:w-auto sm:rounded-2xl sm:px-6 sm:py-3.5">
                Explore markets <ChevronRight size={18} />
              </Link>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.08 }} className="fxzone-landing-panel rounded-2xl border border-sky-200/20 bg-slate-900/55 p-3 shadow-2xl shadow-sky-950/40 backdrop-blur-xl sm:rounded-3xl sm:p-6">
            <div className="mb-5 flex flex-col gap-3 min-[390px]:flex-row min-[390px]:items-center min-[390px]:justify-between sm:mb-6">
              <div>
                <p className="text-lg font-bold text-white">Market overview</p>
                <p className="mt-1 text-sm text-slate-400">Quotes refresh automatically when available.</p>
              </div>
              <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${marketStatus === 'Live' ? 'bg-emerald-400/10 text-emerald-300' : marketStatus === 'Unavailable' ? 'bg-slate-700/70 text-slate-300' : 'bg-amber-300/10 text-amber-200'}`}>
                <span className={`h-2 w-2 rounded-full ${marketStatus === 'Live' ? 'bg-emerald-400' : marketStatus === 'Unavailable' ? 'bg-slate-400' : 'bg-amber-300'}`} /> {marketStatus}
              </span>
            </div>
            <div className="grid gap-4 sm:grid-cols-[1.15fr_0.85fr]">
              <div className="fxzone-landing-subpanel rounded-xl border border-white/10 bg-slate-950/45 p-2 sm:rounded-2xl sm:p-3">
                {marketPreview.length > 0 ? marketPreview.map((quote) => {
                  const positive = quote.change_pct >= 0;
                  return <div key={quote.symbol} className="flex items-center justify-between border-b border-white/8 px-2 py-3.5 last:border-0 sm:py-4">
                    <div><p className="font-bold text-white">{quote.symbol.replace('USD', '')}</p><p className="text-xs text-slate-400">{quote.symbol}</p></div>
                    <div className="text-right"><p className="font-semibold text-slate-100">{formatQuotePrice(quote)}</p><p className={`mt-1 text-xs font-bold ${positive ? 'text-emerald-300' : 'text-rose-300'}`}>{positive ? '+' : ''}{quote.change_pct.toFixed(2)}%</p></div>
                  </div>;
                }) : <div className="flex min-h-72 items-center justify-center px-5 text-center text-sm leading-6 text-slate-400">{loadingQuotes ? 'Loading current market data…' : 'Market data is temporarily unavailable. Try again from Markets.'}</div>}
              </div>
              <div className="fxzone-landing-research relative overflow-hidden rounded-xl border border-sky-300/15 bg-gradient-to-br from-sky-500/15 to-indigo-950/45 p-4 sm:rounded-2xl sm:p-5">
                <p className="text-sm font-medium text-slate-300">Research workspace</p>
                <p className="mt-3 text-xl font-black text-white sm:text-2xl">One place to follow what matters.</p>
                <div className="mt-7 space-y-3 sm:mt-10">
                  {['Follow market movement', 'Save your research', 'Join the conversation'].map((item) => <p key={item} className="flex items-center gap-2 text-sm text-slate-200"><CheckCircle2 size={16} className="text-sky-300" />{item}</p>)}
                </div>
                <TrendingUp className="absolute -bottom-7 -right-5 h-32 w-32 text-sky-400/25" strokeWidth={1} />
              </div>
            </div>
          </motion.div>
        </section>

        <LandingMarkets quotes={quotes} loading={loadingQuotes} onInspect={inspectSymbol} />

        <LandingDetails quotes={quotes} loading={loadingQuotes} onInspect={inspectSymbol} />

        <section aria-label="FxZone at a glance" className="border-y border-white/10 py-8 sm:py-12">
          <div className="grid gap-7 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
            {[
              { icon: ShieldCheck, title: 'Research first', description: 'Provider quote freshness is always visible.' },
              { icon: Sparkles, title: 'AI assisted', description: 'Use the terminal AI assistant to explore ideas.' },
              { icon: TrendingUp, title: 'Community driven', description: 'Share analysis and learn from other traders.' },
              { icon: Zap, title: 'Built to move', description: 'Move from research to charting in one flow.' },
            ].map(({ icon: Icon, title, description }) => (
              <div key={title} className="border-white/10 sm:border-r sm:pr-7 sm:[&:nth-child(2n)]:border-r-0 lg:border-r lg:pr-8 lg:[&:nth-child(2n)]:border-r lg:last:border-0">
                <span className="mb-4 inline-flex rounded-xl border border-sky-300/20 bg-sky-500/10 p-3 text-sky-300"><Icon size={25} /></span>
                <h2 className="text-base font-bold text-white">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="py-16 text-center sm:py-28">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-300">Your market workspace</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">Ready to experience FxZone?</h2>
          <p className="mx-auto mt-5 max-w-2xl text-slate-400">Create a profile, follow the markets you care about, share your analysis, and make your research easier to act on.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 min-[390px]:flex-row">
            <Link href="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 font-bold text-slate-950 transition hover:bg-sky-100">Create your free account <ArrowRight size={18} /></Link>
            <Link href="/dashboard" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border px-6 py-3.5 font-bold text-text transition hover:border-sky-400">Launch terminal <ArrowRight size={18} /></Link>
          </div>
        </section>

        <footer className="border-t border-white/10 py-8 text-center text-sm text-slate-400 sm:py-10">
          <div className="flex items-center justify-center gap-2">
            <Image src="/fxzone-logo.jpg" alt="FxZone logo" width={28} height={28} className="h-7 w-7 rounded-md border border-border object-cover" />
            <span className="text-lg font-black text-text">FxZone</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {socialLinks.map(({ href, label, icon: Icon }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition hover:border-sky-300/60 hover:bg-sky-400/10 hover:text-sky-300">
                <Icon size={18} />
              </a>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
            <Link href="/terms" className="hover:text-text">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-text">Privacy Policy</Link>
            <Link href="/risk-disclosure" className="hover:text-amber-400">Risk disclosure</Link>
          </div>
          <p className="mx-auto mt-4 max-w-2xl text-xs leading-5 text-text-muted">© {new Date().getFullYear()} FxZone. Leveraged financial trading carries risk. Market and AI content is for research only and is not financial or investment advice.</p>
        </footer>
      </div>
    </main>
  );
}
