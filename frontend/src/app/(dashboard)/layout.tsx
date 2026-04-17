import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ToastContextProvider, Toaster } from '@/components/ui/Toast';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthProvider>
      <ToastContextProvider>
        <div className="min-h-screen bg-slate-50">
          <Sidebar />
          <div className="lg:pl-64">
            <Header />
            <main className="py-6 px-4 sm:px-6 lg:px-8">
              {children}
            </main>
          </div>
        </div>
        <Toaster />
      </ToastContextProvider>
    </AuthProvider>
  );
}
