'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';

type Quote = {
  symbol: string;
  price: number;
  change_pct: number;
  freshness?: 'live' | 'cached' | 'stale';
  is_stale?: boolean;
};

const featuredSymbols = ['BTCUSD', 'ETHUSD', 'SOLUSD', 'XRPUSD'];

const benefits = [
  {
    icon: BarChart3,
    title: 'Market data',
    description: 'Provider-backed quotes with clear freshness status.',
  },
  {
    icon: BrainCircuit,
    title: 'AI insights',
    description: 'Turn market context into a clearer research workflow.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure by design',
    description: 'Your account and community activity stay protected.',
  },
  {
    icon: Zap,
    title: 'Built to move',
    description: 'Follow forex, crypto, stocks, and commodities in one place.',
  },
];

function formatPrice(value: number) {
  if (value >= 1_000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(value);
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 6 : 2,
  }).format(value);
}

function isQuote(value: unknown): value is Quote {
  if (!value || typeof value !== 'object') return false;
  const quote = value as Record<string, unknown>;
  return typeof quote.symbol === 'string'
    && typeof quote.price === 'number'
    && typeof quote.change_pct === 'number';
}

export default function LandingPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(true);

  useEffect(() => {
    let active = true;

    const loadQuotes = async () => {
      try {
        const response = await fetch(`/api/market/prices?symbols=${featuredSymbols.join(',')}`, {
          cache: 'no-store',
        });
        if (!response.ok) return;

        const data: unknown = await response.json();
        const values = Array.isArray(data)
          ? data
          : data && typeof data === 'object'
            ? Object.values(data)
            : [];

        if (active) setQuotes(values.filter(isQuote));
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
      .filter((quote): quote is Quote => Boolean(quote)),
    [quotes],
  );

  const marketStatus = loadingQuotes
    ? 'Loading'
    : marketPreview.some((quote) => quote.freshness === 'live')
      ? 'Live'
      : marketPreview.length > 0
        ? 'Delayed'
        : 'Unavailable';

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07101f] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_4%_0%,rgba(37,99,235,0.34),transparent_27%),radial-gradient(circle_at_95%_32%,rgba(14,165,233,0.18),transparent_30%),linear-gradient(130deg,#07101f_0%,#0b1526_53%,#07101f_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-[28rem] h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-3 pb-9 pt-3 sm:px-6 sm:pb-12 sm:pt-5 lg:px-10">
        <header className="flex min-h-16 items-center justify-between rounded-xl border border-white/10 bg-slate-950/45 px-3 shadow-2xl shadow-sky-950/25 backdrop-blur-xl sm:min-h-20 sm:rounded-2xl sm:px-7">
          <Link href="/" className="flex items-center gap-3" aria-label="FxZone home">
            <span className="text-xl font-black tracking-tight text-white sm:text-3xl">Fx<span className="text-sky-400">Zone</span></span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-300 lg:flex" aria-label="Primary navigation">
            <a href="#home" className="text-white transition hover:text-sky-300">Home</a>
            <Link href="/markets" className="transition hover:text-sky-300">Markets</Link>
            <Link href="/ai" className="transition hover:text-sky-300">AI Insights</Link>
            <a href="#features" className="transition hover:text-sky-300">Features</a>
            <Link href="/dashboard" className="transition hover:text-sky-300">Performance</Link>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <Link href="/markets" className="hidden rounded-xl p-2.5 text-sky-300 transition hover:bg-white/10 sm:inline-flex" aria-label="Search markets"><Search size={19} /></Link>
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
              <Link href="/markets" className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 font-semibold text-white transition hover:border-sky-300/60 hover:bg-white/5 min-[390px]:w-auto sm:rounded-2xl sm:px-6 sm:py-3.5">
                Explore markets <ChevronRight size={18} />
              </Link>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.08 }} className="rounded-2xl border border-sky-200/20 bg-slate-900/55 p-3 shadow-2xl shadow-sky-950/40 backdrop-blur-xl sm:rounded-3xl sm:p-6">
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
              <div className="rounded-xl border border-white/10 bg-slate-950/45 p-2 sm:rounded-2xl sm:p-3">
                {marketPreview.length > 0 ? marketPreview.map((quote) => {
                  const positive = quote.change_pct >= 0;
                  return <div key={quote.symbol} className="flex items-center justify-between border-b border-white/8 px-2 py-3.5 last:border-0 sm:py-4">
                    <div><p className="font-bold text-white">{quote.symbol.replace('USD', '')}</p><p className="text-xs text-slate-400">{quote.symbol}</p></div>
                    <div className="text-right"><p className="font-semibold text-slate-100">{formatPrice(quote.price)}</p><p className={`mt-1 text-xs font-bold ${positive ? 'text-emerald-300' : 'text-rose-300'}`}>{positive ? '+' : ''}{quote.change_pct.toFixed(2)}%</p></div>
                  </div>;
                }) : <div className="flex min-h-72 items-center justify-center px-5 text-center text-sm leading-6 text-slate-400">{loadingQuotes ? 'Loading current market data…' : 'Market data is temporarily unavailable. Try again from Markets.'}</div>}
              </div>
              <div className="relative overflow-hidden rounded-xl border border-sky-300/15 bg-gradient-to-br from-sky-500/15 to-indigo-950/45 p-4 sm:rounded-2xl sm:p-5">
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

        <section id="features" className="border-y border-white/10 py-8 sm:py-12">
          <div className="grid gap-7 sm:grid-cols-2 sm:gap-8 lg:grid-cols-4">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return <div key={benefit.title} className="border-white/10 sm:border-r sm:pr-7 sm:[&:nth-child(2n)]:border-r-0 lg:border-r lg:pr-8 lg:[&:nth-child(2n)]:border-r lg:last:border-0">
                <span className="mb-4 inline-flex rounded-xl border border-sky-300/20 bg-sky-500/10 p-3 text-sky-300"><Icon size={25} /></span>
                <h2 className="text-base font-bold text-white">{benefit.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">{benefit.description}</p>
              </div>;
            })}
          </div>
        </section>

        <section className="py-16 text-center sm:py-28">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-300">Your market workspace</p>
          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">Make every next move better informed.</h2>
          <p className="mx-auto mt-5 max-w-2xl text-slate-400">Set up your profile, follow the markets you care about, and make your research easier to act on.</p>
          <Link href="/register" className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 font-bold text-slate-950 transition hover:bg-sky-100">Create your free account <ArrowRight size={18} /></Link>
        </section>

        <footer className="flex flex-col gap-4 border-t border-white/10 py-7 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:py-8">
          <span>© {new Date().getFullYear()} FxZone. Market research, made clearer.</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2"><Link href="/markets" className="hover:text-white">Markets</Link><Link href="/login" className="hover:text-white">Log in</Link><Link href="/register" className="hover:text-white">Get started</Link></div>
        </footer>
      </div>
    </main>
  );
}
