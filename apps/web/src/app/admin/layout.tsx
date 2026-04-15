import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminSidebar from '@/components/layout/admin-sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) redirect('/admin/login');
  if (!session.user.isPlatformOwner) redirect('/login');

  return (
    <div className="flex min-h-screen bg-[#0f1a14]">
      <AdminSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-white/8 px-6">
          <div />
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40">{session.user.email}</span>
            <a
              href="/api/auth/logout"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/50 transition hover:border-white/20 hover:text-white/80"
            >
              Sair
            </a>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
