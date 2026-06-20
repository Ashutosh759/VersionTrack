import React from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GitBranch, LogOut, FileText, User } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950 px-6 py-3">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 text-zinc-50 hover:text-white transition-colors">
          <GitBranch className="h-5 w-5 text-zinc-400" />
          <span className="font-mono text-sm font-semibold tracking-wider">VersionTrack</span>
        </Link>

        {/* Navigation Info */}
        <div className="hidden items-center gap-2 text-xs font-mono text-zinc-500 md:flex">
          <span>/</span>
          <Link to="/" className="hover:text-zinc-300">workspace</Link>
          {location.pathname.includes('/documents/') && (
            <>
              <span>/</span>
              <span className="text-zinc-300">document</span>
            </>
          )}
        </div>

        {/* User Stats / Logout */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-xs text-zinc-400">
            <User className="h-3.5 w-3.5" />
            <span className="font-mono">{user.username}</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-transparent px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition-all cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
