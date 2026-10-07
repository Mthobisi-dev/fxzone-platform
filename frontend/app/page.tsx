'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Github, Instagram, Linkedin, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';
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
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    let active = true;
    const loadQuotes = async () => {
      try {
        const response = await fetch(`/api/market/prices?symbols=${landingSymbols.join(',')}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data: unknown = await response.json();
        const values = Array.isArray(data) ? data : data && typeof data === 'object' ? Object.values(data) : [];
        if (active) setQuotes(values.filter(isLandingQuote));
      } catch {
        // A temporary provider failure is represented in the workspace, never as invented data.
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
    () => featuredSymbols.map((symbol) => quotes.find((quote) => quote.symbol === symbol)).filter((quote): quote is LandingQuote => Boolean(quote)),
    [quotes],
  );
  const marketStatus = loadingQuotes ? 'Loading' : marketPreview.some((quote) => quote.freshness === 'live') ? 'Live' : marketPreview.length > 0 ? 'Delayed' : 'Unavailable';
  const inspectSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
    setTradeModalOpen(true);
  };

  return (
    <main className="fxzone-landing relative min-h-screen overflow-hidden bg-[var(--color-background)] text-slate-100">
      <TradeActionModal isOpen={tradeModalOpen} onClose={() => setTradeModalOpen(false)} symbol={selectedSymbol} />
      <div className="fxzone-landing-backdrop pointer-events-none absolute inset-0" />
      <motion.div
        aria-hidden="true"
        className="fxzone-landing-watermark pointer-events-none absolute left-1/2 top-20 -z-0"
        animate={reduceMotion ? undefined : { x: ['-52%', '-48%', '-52%'], y: [-20, 16, -20], rotate: [-3, 2, -3] }}
        transition={reduceMotion ? undefined : { duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Image src="/fxzone-logo.jpg" alt="" width={560} height={560} priority className="h-auto w-[24rem] max-w-none rounded-[4.5rem] sm:w-[34rem]" />
      </motion.div>

      <div className="relative z-10 mx-auto max-w-7xl px-3 pb-8 pt-3 sm:px-6 sm:pb-12 sm:pt-5 lg:px-10">
        <header className="fxzone-landing-nav flex min-h-16 items-center justify-between rounded-xl border border-white/10 px-3 shadow-2xl shadow-sky-950/25 backdrop-blur-xl sm:min-h-20 sm:rounded-2xl sm:px-7">
          <Link href="/" className="flex items-center gap-3" aria-label="FxZone home">
            <Image src="/fxzone-logo.jpg" alt="" width={36} height={36} className="h-8 w-8 rounded-lg border border-border object-cover sm:h-9 sm:w-9" />
            <span className="text-xl font-black tracking-tight text-white sm:text-3xl">Fx<span className="text-sky-400">Zone</span></span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <Link href="/login" className="hidden rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-sky-300/60 hover:bg-white/5 min-[390px]:inline-flex sm:px-5">Log in</Link>
            <Link href="/register" className="rounded-lg bg-sky-500 px-3 py-2 text-xs font-bold text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400 sm:rounded-xl sm:px-5 sm:text-sm"><span className="sm:hidden">Join free</span><span className="hidden sm:inline">Get started</span></Link>
          </div>
        </header>

        <section className="grid items-center gap-10 py-16 sm:py-24 lg:min-h-[650px] lg:grid-cols-[0.85fr_1.15fr] lg:gap-16 lg:py-28">
          <motion.div initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-100 backdrop-blur-sm"><Sparkles size={14} className="text-sky-300" /> Market intelligence, in one place</div>
            <h1 className="max-w-xl text-4xl font-black leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-7xl">Trade with a clearer view.</h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-slate-300 sm:text-lg">Follow markets, organise your research, and connect with traders on one focused platform.</p>
            <div className="mt-8 flex flex-col gap-3 min-[390px]:flex-row">
              <Link href="/register" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sky-500 px-6 py-3.5 font-bold text-white shadow-xl shadow-sky-500/20 transition hover:bg-sky-400">Get started <ArrowRight size={18} /></Link>
              <Link href="/dashboard" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-6 py-3.5 font-semibold text-white transition hover:border-sky-300/60 hover:bg-white/5">Explore markets</Link>
            </div>
          </motion.div>

          <motion.div initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.55, delay: 0.08 }} className="fxzone-laptop mx-auto w-full max-w-2xl">
            <div className="fxzone-laptop-screen rounded-[1.35rem] border border-sky-200/25 p-2 shadow-2xl shadow-sky-950/50 sm:rounded-[1.8rem] sm:p-3">
              <div className="fxzone-laptop-display overflow-hidden rounded-xl border border-white/10 p-4 sm:rounded-[1.25rem] sm:p-6">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4"><div className="flex items-center gap-2 text-sm font-bold text-white"><span className="h-2 w-2 rounded-full bg-sky-400" /> FxZone workspace</div><span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${marketStatus === 'Live' ? 'text-emerald-300' : 'text-slate-300'}`}><span className={`h-1.5 w-1.5 rounded-full ${marketStatus === 'Live' ? 'bg-emerald-400' : 'bg-slate-400'}`} /> {marketStatus}</span></div>
                <div className="grid gap-4 pt-4 sm:grid-cols-[1.15fr_0.85fr] sm:pt-6">
                  <div className="fxzone-laptop-chart rounded-xl border border-sky-300/15 p-4 sm:min-h-[245px]"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Market pulse</p><p className="mt-3 text-xl font-black text-white">{marketPreview[0]?.symbol ?? 'Market watch'}</p><p className="mt-1 text-sm text-slate-300">{marketPreview[0] ? formatQuotePrice(marketPreview[0]) : loadingQuotes ? 'Loading current quote…' : 'Quote unavailable'}</p><div className="fxzone-laptop-chart-grid mt-7 flex h-24 items-end"><TrendingUp className="h-16 w-full text-sky-300/80" strokeWidth={1.5} /></div><button type="button" onClick={() => inspectSymbol(marketPreview[0]?.symbol ?? 'BTCUSD')} className="mt-5 text-sm font-bold text-sky-300 transition hover:text-sky-200">Open market workspace →</button></div>
                  <div className="rounded-xl border border-white/10 bg-slate-950/25 p-3 sm:p-4"><p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Watchlist</p><div className="mt-2 divide-y divide-white/10">{marketPreview.length > 0 ? marketPreview.slice(0, 3).map((quote) => <button type="button" key={quote.symbol} onClick={() => inspectSymbol(quote.symbol)} className="flex w-full items-center justify-between px-1 py-3 text-left transition hover:text-sky-200"><span className="text-sm font-bold text-white">{quote.symbol}</span><span className={`text-xs font-bold ${quote.change_pct >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{quote.change_pct >= 0 ? '+' : ''}{quote.change_pct.toFixed(2)}%</span></button>) : <p className="px-1 py-5 text-sm leading-5 text-slate-400">{loadingQuotes ? 'Loading watchlist…' : 'Quotes are temporarily unavailable.'}</p>}</div></div>
                </div>
              </div>
            </div>
            <div aria-hidden="true" className="fxzone-laptop-base mx-auto h-3 w-[84%] rounded-b-[1.8rem] border-x border-b border-sky-200/15" />
          </motion.div>
        </section>

        <section className="grid gap-3 border-y border-white/10 py-7 sm:grid-cols-3 sm:gap-0 sm:py-9">
          {[{ icon: TrendingUp, title: 'Market context', text: 'Track the instruments you care about.' }, { icon: Sparkles, title: 'Research tools', text: 'Keep ideas and updates together.' }, { icon: ShieldCheck, title: 'Built for focus', text: 'A clean workspace for every device.' }].map(({ icon: Icon, title, text }) => <div key={title} className="flex items-center gap-3 px-2 py-3 sm:px-6 sm:first:pl-0 sm:not(:last-child):border-r sm:not(:last-child):border-white/10"><span className="rounded-lg border border-sky-300/20 bg-sky-500/10 p-2.5 text-sky-300"><Icon size={20} /></span><div><h2 className="font-bold text-white">{title}</h2><p className="mt-0.5 text-sm text-slate-400">{text}</p></div></div>)}
        </section>

        <section className="py-16 text-center sm:py-24"><h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">Your trading workspace, ready when you are.</h2><Link href="/register" className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 font-bold text-slate-950 transition hover:bg-sky-100">Create your account <ArrowRight size={18} /></Link></section>

        <footer className="border-t border-white/10 py-8 text-center text-sm text-slate-400 sm:py-10"><div className="flex items-center justify-center gap-2"><Image src="/fxzone-logo.jpg" alt="FxZone logo" width={28} height={28} className="h-7 w-7 rounded-md border border-border object-cover" /><span className="text-lg font-black text-text">FxZone</span></div><div className="mt-4 flex flex-wrap items-center justify-center gap-2">{socialLinks.map(({ href, label, icon: Icon }) => <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition hover:border-sky-300/60 hover:bg-sky-400/10 hover:text-sky-300"><Icon size={18} /></a>)}</div><div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs"><Link href="/terms" className="hover:text-text">Terms</Link><Link href="/privacy" className="hover:text-text">Privacy</Link><Link href="/risk-disclosure" className="hover:text-amber-400">Risk disclosure</Link></div><p className="mx-auto mt-4 max-w-2xl text-xs leading-5 text-text-muted">© {new Date().getFullYear()} FxZone. Market content is for research only and is not investment advice.</p></footer>
      </div>
    </main>
  );
}
