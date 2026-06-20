import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GitBranch, Lock, Mail, AlertCircle } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setError('');
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);

    if (result.success) {
      navigate('/');
    } else {
      setError(result.message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-sm space-y-8">
        {/* Header Logo */}
        <div className="flex flex-col items-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50">
            <GitBranch className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-6 text-center text-xl font-semibold font-mono tracking-tight text-white">
            Sign in to VersionTrack
          </h2>
          <p className="mt-2 text-center text-xs font-mono text-zinc-500">
            Distributed document version control platform
          </p>
        </div>

        <div className="border border-zinc-800 bg-zinc-900/25 p-6 rounded-lg space-y-6">
          {error && (
            <div className="flex items-center gap-2 rounded-md border border-red-900/30 bg-red-950/20 px-3 py-2.5 text-xs text-red-400 font-mono">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900/50 py-2 pl-10 pr-3 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                  placeholder="name@company.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900/50 py-2 pl-10 pr-3 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-700"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-white py-2 text-xs font-mono font-medium text-black hover:bg-zinc-200 transition-colors focus:outline-none disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'AUTHENTICATING...' : 'SIGN IN'}
            </button>
          </form>

          <div className="text-center">
            <span className="text-xs font-mono text-zinc-500">
              New to VersionTrack?{' '}
              <Link to="/register" className="text-zinc-300 hover:text-white underline">
                Create an account
              </Link>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
