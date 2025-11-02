"use client";
import { useSyncExternalStore } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/registry/new-york-v4/ui/tabs';
import { getBleState, subscribe } from '@/lib/ble/store';

export function ActivityTabs() {
  const st = useSyncExternalStore(subscribe, getBleState, getBleState);
  return (
    <Tabs defaultValue="log" className="w-full">
      <TabsList>
        <TabsTrigger value="log">Log</TabsTrigger>
        <TabsTrigger value="ddm">DDM</TabsTrigger>
        <TabsTrigger value="events">Events</TabsTrigger>
      </TabsList>
      <TabsContent value="log">
        <div className="h-[320px] overflow-auto rounded-md border border-neutral-200 p-3 text-sm dark:border-neutral-800">
          {st.logs.length === 0 && <div className="text-neutral-500">No logs yet.</div>}
          {st.logs.map((l, i) => (
            <div key={i} className="whitespace-pre-wrap">
              {l}
            </div>
          ))}
        </div>
      </TabsContent>
      <TabsContent value="ddm">
        <div className="rounded-md border border-neutral-200 p-3 text-sm text-neutral-500 dark:border-neutral-800">
          DDM view coming soon.
        </div>
      </TabsContent>
      <TabsContent value="events">
        <div className="rounded-md border border-neutral-200 p-3 text-sm text-neutral-500 dark:border-neutral-800">
          Event feed coming soon.
        </div>
      </TabsContent>
    </Tabs>
  );
}

