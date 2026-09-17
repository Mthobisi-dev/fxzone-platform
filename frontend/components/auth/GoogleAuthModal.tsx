'use client';

import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { Shield } from 'lucide-react';

interface GoogleAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export function GoogleAuthModal({ isOpen, onClose }: GoogleAuthModalProps) {
  const { loginWithGoogle, isLoading } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      await loginWithGoogle();
      // Page will redirect via OAuth — no need to call onClose
    } catch {
      // Error is stored in authStore, nothing else to do here
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Continue with Google">
      <div className="py-2 flex flex-col gap-5 text-zinc-200">
        {/* Google Identity Brand Banner */}
        <div className="flex items-center gap-3 p-4 rounded-xl bg-zinc-900/80 border border-zinc-800">
          <div className="h-12 w-12 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-md">
            <svg className="h-7 w-7" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.15C3.25 21.3 7.31 24 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.27C.46 8.2 0 10.05 0 12c0 1.95.46 3.8 1.27 5.42l4.01-3.15z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.58l4.01 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Sign in with Google</h4>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              You will be redirected to Google to complete sign-in securely.
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold h-10 text-xs shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <span>Redirecting to Google...</span>
          ) : (
            <>
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </>
          )}
        </Button>

        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 justify-center pt-1 border-t border-zinc-800">
          <Shield size={12} className="text-emerald-400" />
          <span>OAuth 2.0 Encrypted Authorization via Supabase</span>
        </div>
      </div>
    </Modal>
  );
}
