import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/auth/AuthProvider';
import { ToastContextProvider, Toaster } from '@/components/ui/Toast';

export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AuthProvider>
      <ToastContextProvider>
        {children}
        <Toaster />
      </ToastContextProvider>
    </AuthProvider>
  );
}
