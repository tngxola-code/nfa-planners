import { redirect } from 'next/navigation';
import { getSessionFromCookies } from '@/lib/auth/serverSession';
import Sidebar from '@/components/sidebar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionFromCookies();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1 bg-[#F4F6F8]">{children}</div>
    </div>
  );
}
