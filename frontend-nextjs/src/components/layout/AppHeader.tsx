"use client";
import Link from 'next/link';
import { ModeToggle } from '@/components/mode-toggle';
import { StatusIndicator } from '@/components/layout/StatusIndicator';

export function AppHeader() {
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
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <StatusIndicator />
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}
