"use client";
import { ModeToggle } from '@/components/mode-toggle';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-200 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:border-neutral-800">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">SFPLiberate</span>
          <span className="text-xs text-neutral-500">Next.js + shadcn</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>
    </header>
  );
}

