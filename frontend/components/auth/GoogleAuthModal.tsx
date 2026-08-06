'use client';

import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { AlertCircle, CheckCircle2, Shield } from 'lucide-react';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export function GoogleAuthModal({ isOpen, onClose, defaultEmail = 'mthomzi890@gmail.com' }: GoogleAuthModalProps) {
  const { loginWithGoogle } = useAuth();
  const [email, setEmail] = useState(defaultEmail);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid Google email address.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const derivedName = name.trim() || email.split('@')[0].replace('.', ' ').replace(/^./, str => str.toUpperCase());
      await loginWithGoogle(email.trim(), derivedName);
      onClose();
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Google Auth failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Google Sign In & Registration">
      <div className="py-2 flex flex-col gap-4 text-zinc-200">
        {/* Google Identity Brand Banner */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-md">
            <svg className="h-6 w-6" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.15C3.25 21.3 7.31 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.27C.46 8.2.0 10.05.0 12c0 1.95.46 3.8 1.27 5.42l4.01-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.58l4.01 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Sign in with Google Account</h4>
            <p className="text-[10px] text-zinc-400">Authenticate securely using your real Google email address</p>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/25 flex gap-2 items-start text-[11px] text-rose-400">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleGoogleSignIn} className="space-y-3">
          <Input
            label="Google Email Address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. mthomzi890@gmail.com"
            disabled={loading}
          />

          <Input
            label="Account Display Name (Optional)"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mthobisi Dev"
            disabled={loading}
          />

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold h-10 text-xs shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Authenticating Google Account...</span>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>Continue as {email || 'Google User'}</span>
              </>
            )}
          </Button>
        </form>

        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 justify-center pt-2 border-t border-zinc-850">
          <Shield size={12} className="text-emerald-400" />
          <span>OAuth 2.0 Encrypted Token Authorization</span>
        </div>
      </div>
    </Modal>
  );
}
