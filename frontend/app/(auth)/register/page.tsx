'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Shield, Sparkles, AlertCircle, TrendingUp, Cpu, GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';
import { GoogleAuthModal } from '@/components/auth/GoogleAuthModal';

export default function RegisterPage() {
  const router = useRouter();
  const { register, loginWithGoogle, error: authError } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'trader' | 'analyst' | 'verified_educator'>('trader');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName || !username || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await register({
        email,
        username,
        password,
        role,
        display_name: displayName,
      });
      router.push('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err?.detail || authError || 'Registration parameters validation failed.');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    {
      id: 'trader' as const,
      title: 'Trader',
      icon: <TrendingUp size={16} className="text-emerald-400" />,
      desc: 'Active market operator',
    },
    {
      id: 'analyst' as const,
      title: 'Analyst',
      icon: <Cpu size={16} className="text-purple-400" />,
      desc: 'Technical & ML insights developer',
    },
    {
      id: 'verified_educator' as const,
      title: 'Educator',
      icon: <GraduationCap size={16} className="text-blue-400" />,
      desc: 'Webinar broadcast publisher',
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950/60 backdrop-blur-md flex select-none">
      {/* Left visual column */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-950/50 border-r border-zinc-800/80 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px]" />
        
        <div className="flex items-center gap-3 z-10">
          <img
            src="/fxzone-logo.jpg"
            alt="FxZone Logo"
            className="h-11 w-11 rounded-xl object-cover shadow-[0_0_20px_rgba(255,255,255,0.15)] border border-zinc-700"
          />
          <span className="text-xl font-black tracking-tight text-white">FxZone</span>
        </div>

        <div className="max-w-md z-10">
          <h2 className="text-3xl font-black text-white leading-tight mb-4 flex items-center gap-2">
            Create Account <Sparkles size={24} className="text-purple-400" />
          </h2>
          <p className="text-xs text-zinc-300 leading-relaxed">
            Join FxZone to access real-time multi-asset market streams, Gemini AI technical sentiment analysis, and community insights.
          </p>
        </div>

        <div className="text-[10px] text-zinc-400 z-10 flex gap-2 items-center">
          <Shield size={12} className="text-emerald-400" /> Encrypted SSL trading session
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
              <div className="text-center mb-5">
                <h3 className="text-lg font-bold text-white mb-1">Create Account</h3>
                <p className="text-[10px] text-zinc-400">Set up your FxZone trading profile.</p>
              </div>

              {/* Error messages */}
              {error && (
                <div className="mb-4 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 flex gap-2 items-start text-[10px] text-rose-400 leading-normal animate-pulse">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <Input
                  label="Full Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="E.g., Alex Vance"
                  disabled={loading}
                />
                
                <Input
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="E.g., alex_trades"
                  disabled={loading}
                />

                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  disabled={loading}
                />

                {/* Role Selector Grid */}
                <div className="space-y-1 pt-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Select Role</label>
                  <div className="grid grid-cols-3 gap-1.5 pt-0.5">
                    {roles.map((r) => {
                      const active = role === r.id;
                      return (
                        <div
                          key={r.id}
                          onClick={() => !loading && setRole(r.id)}
                          className={`p-2 border rounded-xl flex flex-col items-center justify-between text-center cursor-pointer transition-all ${
                            active
                              ? 'bg-purple-600/15 border-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.2)]'
                              : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                          }`}
                        >
                          {r.icon}
                          <span className="text-[10px] font-bold mt-1 block">{r.title}</span>
                          <span className="text-[7px] text-zinc-500 mt-0.5 block truncate max-w-full leading-none">
                            {r.desc}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                />

                <Input
                  label="Confirm Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                />

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 h-9 font-semibold text-xs mt-3 shadow-lg shadow-purple-600/20"
                  disabled={loading}
                >
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Button>

                <div className="relative my-2.5 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-zinc-800"></div>
                  </div>
                  <span className="relative px-2 bg-zinc-950 text-[9px] text-zinc-400 uppercase tracking-widest">or</span>
                </div>

                <Button
                  type="button"
                  onClick={() => setIsGoogleModalOpen(true)}
                  className="w-full bg-zinc-900/80 hover:bg-zinc-800/80 text-zinc-200 border border-zinc-750 h-9 font-semibold text-xs flex items-center justify-center gap-2"
                  disabled={loading}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M12.24 10.285V13.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l2.427-2.334C17.955 2.192 15.34 1 12.24 1 6.033 1 12.24 6.033 12.24 12.24s5.033 11.24 11.24 11.24c6.478 0 10.793-4.537 10.793-10.985 0-.746-.08-1.32-.176-1.884H12.24z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </Button>
              </form>

              <div className="text-center mt-5 pt-3 border-t border-zinc-850">
                <span className="text-[10px] text-zinc-400">
                  Already have an account?{' '}
                  <Link href="/login" className="text-purple-400 hover:text-purple-300 font-semibold underline">
                    Sign in
                  </Link>
                </span>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>

      <GoogleAuthModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        defaultEmail="mthomzi890@gmail.com"
      />
    </div>
  );
}
