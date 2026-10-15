'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="mx-auto min-h-screen max-w-4xl bg-zinc-950 p-4 font-sans text-zinc-100 sm:p-6 md:p-12">
      <Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-purple-400 hover:text-purple-300 mb-8 transition-colors">
        <ArrowLeft size={14} /> Back to FxZone
      </Link>

      <div className="flex items-center gap-3 mb-6 border-b border-zinc-800 pb-4">
        <Lock size={28} className="text-emerald-400" />
        <h1 className="text-2xl font-black text-white sm:text-3xl">Privacy Policy</h1>
      </div>

      <div className="space-y-6 text-sm text-zinc-300 leading-relaxed font-normal">
        <p className="text-xs text-zinc-400">Last updated: August 2026</p>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">1. Information Collection</h2>
          <p>We collect essential information required to provide your account and workspace services, including your name, email address, username, and preferred system preferences.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">2. Data Security & Storage</h2>
          <p>All sensitive authentication tokens and profile data are stored securely using industry-standard encryption protocols. We do not sell user data to third parties.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-white">3. Third-Party Integrations</h2>
          <p>When using AI sentiment analysis or OAuth authentication (e.g. Google Auth), non-identifying operational payloads may be processed securely through service APIs.</p>
        </section>
      </div>
    </div>
  );
}
