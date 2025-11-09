'use client';

import { useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useUser } from '@/firebase/auth/use-user';
import { db } from '@/firebase/client';
import { collection, orderBy, query } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const PianoIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M19 2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>
        <path d="M5 10h14"/>
        <path d="M8 10v8"/>
        <path d="M12 10v8"/>
        <path d="M16 10v8"/>
        <path d="M6 6h.01"/>
        <path d="M10 6h.01"/>
        <path d="M14 6h.01"/>
        <path d="M18 6h.01"/>
    </svg>
);


type AuditLog = {
    id: string;
    ts: string;
    actor_type: 'user' | 'system_ai' | 'system_job';
    action: 'create' | 'update' | 'delete' | 'restore' | 'create_ai_draft' | 'create_meeting' | 'create_task' | 'send_email';
    entity_type: string;
    entity_id: string;
    table: string;
    after_snapshot?: { name?: string; title?: string; };
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
    create_ai_draft: 'default',
    create_meeting: 'default',
    create_task: 'default',
    send_email: 'default',
};

export default function OrquestratorPage() {
    const { user } = useUser();

    const logsQuery = useMemo(() => 
        user ? query(collection(db, 'audit_logs'), orderBy('ts', 'desc')) : null
    , [user]);

    const { data: logs, loading: logsLoading } = useCollection<AuditLog>(logsQuery);

    const getEntityName = (log: AuditLog) => {
        if (log.after_snapshot && (log.after_snapshot.name || log.after_snapshot.title)) {
            return log.after_snapshot.name || log.after_snapshot.title;
        }
        return log.entity_id;
    }

  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
            <PianoIcon className="h-7 w-7" />
            Orquestrator
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
                                <span className='font-medium'>{log.action.replace(/_/g, ' ')} {log.entity_type}</span>
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
