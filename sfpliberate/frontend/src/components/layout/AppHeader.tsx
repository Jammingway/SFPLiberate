"use client";
import Link from 'next/link';
import { ModeToggle } from '@/components/mode-toggle';
import { StatusIndicator } from '@/components/layout/StatusIndicator';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/components/providers/AuthProvider';
import { isAppwrite } from '@/lib/features';
import { logout } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { LogOut, User, Shield } from 'lucide-react';

export function AppHeader() {
  const auth = useAuthContext();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:border-neutral-800">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <div className="mr-2 flex items-center gap-2">
          <Link href="/" className="text-base font-semibold hover:opacity-80">
            SFPLiberate
          </Link>
          <span className="text-xs text-neutral-500">Next.js + shadcn</span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
            Dashboard
          </Link>
          <Link href="/modules" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
            Modules
          </Link>
          {isAppwrite() && (
            <Link href="/community" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
              Community
            </Link>
          )}
          {isAppwrite() && auth.isAdmin && (
            <Link href="/admin/submissions" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Admin
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <StatusIndicator />
          {isAppwrite() && !auth.loading && (
            <>
              {auth.isAuthenticated ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {auth.user?.name || auth.user?.email}
                  </span>
                  <Button variant="ghost" size="sm" onClick={handleLogout}>
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => router.push('/login')}>
                  Sign In
                </Button>
              )}
            </>
          )}
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
