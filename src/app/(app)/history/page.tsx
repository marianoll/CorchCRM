'use client';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, orderBy, query, type Firestore } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { History } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type AuditLog = {
    id: string;
    ts: string;
    actor_type: 'user' | 'system_ai' | 'system_job';
    action: 'create' | 'update' | 'delete' | 'restore';
    entity_type: string;
    entity_id: string;
    table: string;
    after_snapshot?: { name?: string };
};

const actorVariant: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
  user: 'default',
  system_ai: 'secondary',
  system_job: 'secondary',
};

const actionVariant: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
    create: 'default',
    update: 'secondary',
    delete: 'destructive',
    restore: 'default',
};

export default function HistoryPage() {
    const firestore = useFirestore();

    const logsQuery = useMemoFirebase(() => 
        firestore 
        ? query(collection(firestore as Firestore, 'audit_logs'), orderBy('ts', 'desc')) 
        : null, 
    [firestore]);

    const { data: logs, loading: logsLoading } = useCollection<AuditLog>(logsQuery);

    const getEntityName = (log: AuditLog) => {
        if (log.after_snapshot && log.after_snapshot.name) {
            return log.after_snapshot.name;
        }
        return log.entity_id;
    }

  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
            <History className="h-7 w-7" />
            History
          </h1>
          <p className="text-muted-foreground">An immutable audit trail of all changes made to the database.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Audit Logs</CardTitle>
                <CardDescription>All create, update, and delete actions are recorded here.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead className="w-[180px]">Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Actor</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logsLoading && <TableRow><TableCell colSpan={4} className="text-center">Loading history...</TableCell></TableRow>}
                    {!logsLoading && logs?.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No history found.</TableCell></TableRow>}
                    {logs?.map((log) => (
                    <TableRow key={log.id}>
                        <TableCell>{format(new Date(log.ts), "MMM d, yyyy, h:mm a")}</TableCell>
                        <TableCell>
                            <div className='flex flex-col'>
                                <span className='font-medium'>{log.action} {log.entity_type}</span>
                                <span className='text-xs text-muted-foreground'>{getEntityName(log)}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant={actionVariant[log.action] || 'secondary'}>{log.action}</Badge>
                        </TableCell>
                        <TableCell>
                            <Badge variant={actorVariant[log.actor_type] || 'secondary'}>{log.actor_type}</Badge>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
    </main>
  );
}
