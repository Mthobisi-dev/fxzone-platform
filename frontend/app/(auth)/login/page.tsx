'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Shield, Sparkles, TrendingUp, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithGoogle, error: authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all credentials.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err?.detail || authError || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950/60 backdrop-blur-md flex select-none">
      {/* Left visual column */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-950/50 border-r border-zinc-800/80 flex-col justify-between p-12 relative overflow-hidden">
        {/* Animated chart visualization grid */}
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" />
        
        <div className="flex items-center gap-3 z-10">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-[0_0_20px_rgba(99,102,241,0.4)]">
            FX
          </div>
          <span className="text-xl font-black tracking-tight text-white">FxZone</span>
        </div>

        <div className="max-w-md z-10">
          <h2 className="text-3xl font-black text-white leading-tight mb-4 flex items-center gap-2">
            Market Intelligence Engine <Sparkles size={24} className="text-purple-400" />
          </h2>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Gain immediate access to WebSocket order flows, real-time ML news relevance pipelines, and encrypted webinar sharing rooms.
          </p>
        </div>

        <div className="text-[10px] text-zinc-400 z-10 flex gap-2 items-center">
          <Shield size={12} className="text-emerald-400" /> Secure SSL trading session
        </div>
      </div>

      {/* Right form column */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-zinc-950/40 relative">
        <div className="w-full max-w-sm">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="p-6 border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl shadow-2xl">
              <div className="text-center mb-6">
                <h3 className="text-lg font-bold text-white mb-1">Access Terminal</h3>
                <p className="text-[10px] text-zinc-400">Input your security credentials below to connect.</p>
              </div>

              {/* Error messages */}
              {error && (
                <div className="mb-4 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 flex gap-2 items-start text-[10px] text-rose-400 leading-normal">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  disabled={loading}
                />
                
                <Input
                  label="Security Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                />

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 h-9 font-semibold text-xs mt-2 shadow-lg shadow-purple-600/20"
                  disabled={loading}
                >
                  {loading ? 'Authorizing Session...' : 'Sign In to Terminal'}
                </Button>

                <div className="relative my-3 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800"></div>
                  </div>
                  <span className="relative px-2 bg-zinc-950 text-[9px] text-zinc-400 uppercase tracking-widest">or</span>
                </div>

                <Button
                  type="button"
                  onClick={async () => {
                    setError(null);
                    setLoading(true);
                    try {
                      await loginWithGoogle();
                    } catch (err: any) {
                      setError(err.message || 'Google Auth failed');
                      setLoading(false);
                    }
                  }}
                  className="w-full bg-zinc-900/80 hover:bg-zinc-800/80 text-zinc-200 border border-zinc-750 h-9 font-semibold text-xs flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.033 1 12.24 6.033 12.24 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.985 0-.746-.08-1.32-.176-1.884H12.24z"
                    />
                  </svg>
                  <span>Sign In with Google</span>
                </Button>
              </form>

              <div className="text-center mt-6 pt-4 border-t border-zinc-850">
                <span className="text-[10px] text-zinc-400">
                  New operator?{' '}
                  <Link href="/register" className="text-purple-400 hover:text-purple-300 font-semibold underline">
                    Create credentials
                  </Link>
                </span>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
