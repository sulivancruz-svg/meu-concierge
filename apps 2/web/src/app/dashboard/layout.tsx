import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/sidebar';
import Header from '@/components/layout/header';
import { ToastProvider } from '@/components/ui/toast-provider';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.user.isPlatformOwner) redirect('/admin');

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-transparent">
        <Sidebar isPlatformOwner={session.user.isPlatformOwner} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header user={session.user} />
          <main className="flex-1 overflow-y-auto px-6 py-6">
            <div className="mx-auto w-full max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
