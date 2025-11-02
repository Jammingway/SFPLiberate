"use client";
import { useSyncExternalStore } from 'react';
import { getBleState, subscribe } from '@/lib/ble/store';

export function LogsPanel() {
  const st = useSyncExternalStore(subscribe, getBleState, getBleState);
  return (
    <div className="h-[320px] overflow-auto rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
      {st.logs.length === 0 && <div className="text-neutral-500">No logs yet.</div>}
      {st.logs.map((l, i) => (
        <div key={i} className="whitespace-pre-wrap">
          {l}
        </div>
      ))}
    </div>
  );
}

