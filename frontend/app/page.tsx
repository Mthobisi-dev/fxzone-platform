'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Github, Instagram, Linkedin, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';

const socialLinks = [
  { href: 'https://www.instagram.com/it.is_jack', label: 'Instagram', icon: Instagram },
  { href: 'https://github.com/Mthobisi-dev', label: 'GitHub', icon: Github },
  { href: 'https://www.linkedin.com/in/mthobisi-mzimela-136835354', label: 'LinkedIn', icon: Linkedin },
];

function FxZoneLiveMark() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className={`fxzone-live-mark fxzone-live-mark--force-motion${isHovered ? ' is-hovered' : ''}`}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      animate={{ y: [-12, 12, -12], rotate: [-1.25, 1.25, -1.25] }}
      transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
    >
      <div className="fxzone-live-candles" aria-hidden="true">
        <div className="fxzone-live-candle fxzone-live-candle-outline fxzone-live-candle-tall"><span className="fxzone-live-wick" /><span className="fxzone-live-body" /></div>
        <div className="fxzone-live-candle fxzone-live-candle-solid fxzone-live-candle-mid"><span className="fxzone-live-wick" /><span className="fxzone-live-body" /></div>
        <div className="fxzone-live-candle fxzone-live-candle-outline fxzone-live-candle-short"><span className="fxzone-live-wick" /><span className="fxzone-live-body" /></div>
      </div>
      <div className="fxzone-live-wordmark">FX<span>ZONE</span></div>
      <div className="fxzone-live-rule" aria-hidden="true" />
    </motion.div>
  );
}

export default function LandingPage() {
  const reduceMotion = useReducedMotion();

  return (
    <main className="fxzone-landing relative min-h-[100svh] overflow-x-hidden bg-[var(--color-background)] text-slate-100">
      <div className="fxzone-landing-backdrop pointer-events-none absolute inset-0" />
      <div
        aria-hidden="true"
        className="fxzone-landing-watermark absolute left-1/2 top-24 -z-0 -translate-x-1/2 sm:top-28"
      >
        <FxZoneLiveMark />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-8 pt-3 sm:px-6 sm:pb-12 sm:pt-5 lg:px-10">
        <header className="fxzone-landing-nav flex min-h-16 items-center justify-between gap-3 rounded-xl border border-white/10 px-3 shadow-2xl shadow-sky-950/25 backdrop-blur-xl sm:min-h-20 sm:rounded-2xl sm:px-7">
          <Link href="/" className="flex items-center gap-3" aria-label="FxZone home">
            <Image src="/fxzone-logo.jpg" alt="" width={36} height={36} className="h-8 w-8 rounded-lg border border-border object-cover sm:h-9 sm:w-9" />
            <span className="text-lg font-black tracking-tight text-white min-[360px]:text-xl sm:text-3xl">Fx<span className="text-sky-400">Zone</span></span>
          </Link>
          <div className="hidden shrink-0 items-center gap-3 sm:flex">
            <Link href="/login" className="rounded-xl border border-white/15 px-5 py-2 text-sm font-semibold text-slate-100 transition hover:border-sky-300/60 hover:bg-white/5">Log in</Link>
            <Link href="/register" className="fxzone-landing-primary-action rounded-xl px-5 py-2 text-sm font-bold">Get started</Link>
          </div>
        </header>

        <section className="flex min-h-[calc(100svh-80px)] items-center py-12 sm:min-h-[620px] sm:items-end sm:py-24 lg:min-h-[690px] lg:py-28">
          <motion.div initial={reduceMotion ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-xl pb-3 text-center sm:w-auto sm:text-left lg:ml-10">
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-sky-300/20 bg-sky-400/10 px-2.5 py-1.5 text-[11px] font-semibold leading-4 text-sky-100 backdrop-blur-sm min-[360px]:gap-2 min-[360px]:px-3 sm:mb-6 sm:py-2 sm:text-xs"><Sparkles size={13} className="fxzone-landing-accent shrink-0 sm:h-3.5 sm:w-3.5" /> Market intelligence, in one place</div>
            <p className="mx-auto max-w-[19rem] text-sm leading-6 text-slate-300 min-[360px]:text-base min-[360px]:leading-7 sm:mx-0 sm:max-w-md sm:text-lg">Follow markets, organise your research, and connect with traders on one focused platform.</p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 min-[390px]:flex-row sm:mt-8 sm:justify-start">
              <Link href="/register" className="fxzone-landing-primary-action inline-flex min-h-11 w-full max-w-56 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold sm:min-h-12 sm:w-auto sm:max-w-none sm:px-6 sm:py-3.5 sm:text-base">Get started <ArrowRight size={17} /></Link>
              <Link href="/dashboard" className="inline-flex min-h-11 w-full max-w-56 items-center justify-center rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-white transition hover:border-sky-300/60 hover:bg-white/5 sm:min-h-12 sm:w-auto sm:max-w-none sm:px-6 sm:py-3.5 sm:text-base">Explore markets</Link>
            </div>
          </motion.div>
        </section>

        <section className="hidden gap-3 border-y border-white/10 py-7 sm:grid sm:grid-cols-3 sm:gap-0 sm:py-9">
          {[{ icon: TrendingUp, title: 'Market context', text: 'Track the instruments you care about.' }, { icon: Sparkles, title: 'Research tools', text: 'Keep ideas and updates together.' }, { icon: ShieldCheck, title: 'Built for focus', text: 'A clean workspace for every device.' }].map(({ icon: Icon, title, text }) => <div key={title} className="flex items-center gap-3 px-2 py-3 sm:px-6 sm:first:pl-0 sm:not(:last-child):border-r sm:not(:last-child):border-white/10"><span className="rounded-lg border border-sky-300/20 bg-sky-500/10 p-2.5 text-sky-300"><Icon size={20} /></span><div><h2 className="font-bold text-white">{title}</h2><p className="mt-0.5 text-sm text-slate-400">{text}</p></div></div>)}
        </section>

        <section className="hidden py-16 text-center sm:block sm:py-24"><h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">Your trading workspace, ready when you are.</h2><Link href="/register" className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 py-3.5 font-bold text-slate-950 transition hover:bg-sky-100">Create your account <ArrowRight size={18} /></Link></section>

        <footer className="border-t border-white/10 py-6 text-center text-sm text-slate-400 sm:py-10"><div className="flex items-center justify-center gap-2"><Image src="/fxzone-logo.jpg" alt="FxZone logo" width={28} height={28} className="h-7 w-7 rounded-md border border-border object-cover" /><span className="text-lg font-black text-text">FxZone</span></div><div className="mt-4 flex flex-wrap items-center justify-center gap-2">{socialLinks.map(({ href, label, icon: Icon }) => <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-300 transition hover:border-sky-300/60 hover:bg-sky-400/10 hover:text-sky-300"><Icon size={18} /></a>)}</div><div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs"><Link href="/terms" className="hover:text-text">Terms</Link><Link href="/privacy" className="hover:text-text">Privacy</Link><Link href="/risk-disclosure" className="hover:text-amber-400">Risk disclosure</Link></div><p className="mx-auto mt-4 max-w-2xl text-xs leading-5 text-text-muted">© {new Date().getFullYear()} FxZone. Market content is for research only and is not investment advice.</p></footer>
      </div>
    </main>
  );
}
