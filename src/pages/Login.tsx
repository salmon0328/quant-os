import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

// Passwordless email login (6-digit code). Deliberately avoids magic-link
// redirects, since those collide with this app's hash-based router.
export function Login() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'email' | 'code'>('email');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    if (!supabase || !email) return;
    setBusy(true);
    setStatus(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setStatus(error.message);
    else {
      setStage('code');
      setStatus(`We sent a 6-digit code to ${email}. Enter it below.`);
    }
  };

  const verifyCode = async () => {
    if (!supabase || !code) return;
    setBusy(true);
    setStatus(null);
    const { error } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setStatus(error.message);
    // On success, onAuthStateChange in AuthProvider updates the session and
    // this screen is replaced automatically.
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white">Q</span>
          <div>
            <div className="text-sm font-bold leading-tight">Quant-OS</div>
            <div className="text-[10px] text-slate-400">sign in to sync across devices</div>
          </div>
        </div>

        {stage === 'email' ? (
          <div className="space-y-3">
            <input
              className="input w-full"
              type="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendCode()}
            />
            <button className="btn-primary w-full" disabled={busy || !email} onClick={sendCode}>
              {busy ? 'Sending…' : 'Send login code'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              className="input w-full tracking-widest"
              inputMode="numeric"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
            />
            <button className="btn-primary w-full" disabled={busy || !code} onClick={verifyCode}>
              {busy ? 'Verifying…' : 'Verify & sign in'}
            </button>
            <button className="btn-ghost w-full" onClick={() => { setStage('email'); setStatus(null); }}>
              Use a different email
            </button>
          </div>
        )}

        {status && <p className="mt-4 text-xs text-slate-500">{status}</p>}
      </div>
    </div>
  );
}
