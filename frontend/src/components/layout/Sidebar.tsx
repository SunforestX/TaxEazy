'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import {
  LayoutDashboard,
  Receipt,
  Building2,
  FlaskConical,
  Users,
  Calculator,
  FileText,
  AlertCircle,
  Settings,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Suppliers', href: '/suppliers', icon: Building2 },
  { name: 'Projects', href: '/projects', icon: FlaskConical },
  { name: 'Payroll', href: '/payroll', icon: Users },
  { name: 'GST/BAS', href: '/gst', icon: Calculator },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Exceptions', href: '/exceptions', icon: AlertCircle },
  { name: 'Settings', href: '/settings', icon: Settings },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4">
      <div className="flex h-16 shrink-0 items-center">
        <Link href="/dashboard" className="flex items-center gap-2" onClick={onLinkClick}>
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">SF</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900 leading-tight">TaxEazy</span>
            <span className="text-xs text-slate-500 leading-tight">SunForestX Therapeutics</span>
          </div>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  onClick={onLinkClick}
                  className={`
                    group flex gap-x-3 rounded-md p-2 text-sm font-medium transition-colors
                    ${isActive
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }
                  `}
                >
                  <item.icon
                    className={`h-5 w-5 shrink-0 ${
                      isActive ? 'text-teal-700' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
        <div className="flex grow flex-col border-r border-slate-200">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={onMobileClose}
          />
          {/* Sidebar panel */}
          <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl animate-in slide-in-from-left duration-200">
            <div className="absolute top-4 right-4">
              <button
                onClick={onMobileClose}
                className="rounded-md p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent onLinkClick={onMobileClose} />
          </div>
        </div>
      )}
    </>
  );
}
