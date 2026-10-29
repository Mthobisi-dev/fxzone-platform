'use client';

import Link from 'next/link';
import { ArrowLeft, BarChart3, MessageCircle, ShieldCheck, Users } from 'lucide-react';

const pillars = [
  {
    icon: BarChart3,
    title: 'Verified market context',
    text: 'FxZone brings provider-supplied quotes, historical candles, market news and transparent freshness labels into one workspace.',
  },
  {
    icon: MessageCircle,
    title: 'Research with other traders',
    text: 'Follow traders, share analysis, discuss ideas and use private conversations to keep research organised.',
  },
  {
    icon: Users,
    title: 'Focused collaboration',
    text: 'Live sessions and shared charts help hosts explain their process while access controls protect private rooms.',
  },
  {
    icon: ShieldCheck,
    title: 'Clear limits',
    text: 'Market information is for research and education. Data may be delayed or unavailable, and FxZone is not a broker or investment adviser.',
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[var(--fx-bg-canvas)] px-4 py-6 text-[var(--fx-text-strong)] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[var(--fx-text-muted)] transition hover:text-[var(--fx-text-strong)]">
          <ArrowLeft size={16} /> Back to FxZone
        </Link>

        <header className="mt-10 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-400">About FxZone</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Market research, organised for clearer decisions.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--fx-text-muted)] sm:text-lg">
            FxZone is a market-intelligence and trader-community workspace. It combines market context, evidence-led research tools, social discussion, private messaging and live sessions in one place.
          </p>
        </header>

        <section className="mt-12 grid gap-4 sm:grid-cols-2" aria-label="FxZone capabilities">
          {pillars.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-2xl border border-[var(--fx-border-subtle)] bg-[var(--fx-bg-surface)] p-5 shadow-sm sm:p-6">
              <Icon size={22} className="text-sky-400" aria-hidden="true" />
              <h2 className="mt-4 text-lg font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--fx-text-muted)]">{text}</p>
            </article>
          ))}
        </section>

        <section className="mt-10 rounded-2xl border border-sky-400/20 bg-sky-400/5 p-5 sm:p-7">
          <h2 className="text-xl font-bold">How to use FxZone</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--fx-text-muted)]">
            Start with the dashboard to review available instruments and their provider status. Use Discover to find traders or news, then save research, follow relevant accounts and join eligible live sessions. Always check the provider, timestamp and freshness label before relying on any market information.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/register" className="inline-flex min-h-11 items-center rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-sky-400">Create an account</Link>
            <Link href="/risk-disclosure" className="inline-flex min-h-11 items-center rounded-xl border border-[var(--fx-border-subtle)] px-5 py-2.5 text-sm font-semibold transition hover:border-sky-400/60">Read the risk disclosure</Link>
          </div>
        </section>

        <footer className="mt-12 border-t border-[var(--fx-border-subtle)] pt-6 text-sm text-[var(--fx-text-muted)]">
          <p>FxZone provides research and collaboration tools. It does not execute trades, hold customer funds or provide personalised investment advice.</p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
            <Link href="/terms" className="hover:text-[var(--fx-text-strong)]">Terms</Link>
            <Link href="/privacy" className="hover:text-[var(--fx-text-strong)]">Privacy</Link>
            <Link href="/risk-disclosure" className="hover:text-[var(--fx-text-strong)]">Risk disclosure</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
