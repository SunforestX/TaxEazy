'use client';

import { useAuth } from '@/components/auth/AuthProvider';
import { User, LogOut } from 'lucide-react';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          {/* Mobile menu button would go here */}
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-7 h-7 bg-teal-600 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-xs">SF</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-900 leading-tight">TaxEazy</span>
              <span className="text-[10px] text-slate-500 leading-tight">SunForest X</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-teal-50 flex items-center justify-center border border-teal-100">
              <User className="h-4 w-4 text-teal-600" />
            </div>
            <div className="hidden sm:block text-sm">
              <p className="font-medium text-slate-900">{user?.name}</p>
              <p className="text-slate-500 capitalize text-xs">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-teal-600 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
