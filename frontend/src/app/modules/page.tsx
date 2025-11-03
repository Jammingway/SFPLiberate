"use client";
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/registry/new-york-v4/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/registry/new-york-v4/ui/table';
import { Button } from '@/registry/new-york-v4/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/registry/new-york-v4/ui/alert-dialog';
import { toast } from 'sonner';
import { features } from '@/lib/features';
import { writeSfpFromModuleId } from '@/lib/ble/manager';

type ModuleRow = {
  id: number;
  vendor?: string;
  model?: string;
  serial?: string;
  size?: number;
  created_at?: string;
};

export default function ModulesPage() {
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(false);

  const base = features.api.baseUrl;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${base}/v1/modules`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = await res.json();
      setRows(list || []);
    } catch (e: any) {
      toast.error(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const onWrite = async (id: number) => {
    try {
      toast('Starting write...', { description: `Module #${id}` });
      await writeSfpFromModuleId(id);
      toast.success('Write flow completed', { description: 'Consider reading back to verify' });
    } catch (e: any) {
      toast.error(e?.message || String(e));
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Modules</h1>
          <p className="mt-1 text-sm text-neutral-500">Saved EEPROM captures</p>
        </div>
        <Button onClick={load} variant="secondary" disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Module Library</CardTitle>
          <CardDescription>Write to device or inspect details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">ID</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead className="w-[160px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-neutral-500">
                      {loading ? 'Loading…' : 'No modules saved yet.'}
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>#{m.id}</TableCell>
                    <TableCell>{m.vendor || '—'}</TableCell>
                    <TableCell>{m.model || '—'}</TableCell>
                    <TableCell>{m.serial || '—'}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="default">
                            Write
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Write module #{m.id} to device?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Writing EEPROM can permanently damage your module if incorrect data is used. Make sure you have a backup and the correct profile is selected.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onWrite(m.id)}>Write</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

