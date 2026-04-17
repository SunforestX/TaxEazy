'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-64 lg:flex-col">
      <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white border-r border-slate-200 px-6 pb-4">
        <div className="flex h-16 shrink-0 items-center">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">SF</span>
            </div>
            <div className="flex flex-col">
              <span className="font-semibold text-slate-900 leading-tight">TaxEazy</span>
              <span className="text-xs text-slate-500 leading-tight">SunForest X Therapeutics</span>
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
    </div>
  );
}
