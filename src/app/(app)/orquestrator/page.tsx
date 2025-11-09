'use client';

import { useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useUser } from '@/firebase/auth/use-user';
import { db } from '@/firebase/client';
import { collection, orderBy, query, Timestamp } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Calendar, Database, TrendingUp } from 'lucide-react';

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
    after_snapshot?: any;
    before_snapshot?: any;
};

type Deal = { id: string; title: string; company_id?: string; };
type Company = { id: string; name: string; };


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

    const dealsQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'deals')) : null, [user]);
    const companiesQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'companies')) : null, [user]);

    const { data: logs, loading: logsLoading } = useCollection<AuditLog>(logsQuery);
    const { data: deals, loading: dealsLoading } = useCollection<Deal>(dealsQuery);
    const { data: companies, loading: companiesLoading } = useCollection<Company>(companiesQuery);
    
    const scheduledEmails = useMemo(() => logs?.filter(log => log.action === 'send_email') || [], [logs]);
    const scheduledMeetings = useMemo(() => logs?.filter(log => log.action === 'create_meeting') || [], [logs]);
    const dealUpdates = useMemo(() => logs?.filter(log => log.entity_type === 'deals' && log.action === 'update') || [], [logs]);
    const generalLogs = useMemo(() => logs?.filter(log => log.action !== 'send_email' && log.action !== 'create_meeting' && (log.entity_type !== 'deals' || log.action !== 'update')) || [], [logs]);


    const getEntityName = (log: AuditLog) => {
        if (log.after_snapshot && (log.after_snapshot.name || log.after_snapshot.title)) {
            return log.after_snapshot.name || log.after_snapshot.title;
        }
        return log.entity_id;
    }
    
    const getCompanyNameForDeal = (dealId: string) => {
        if (dealsLoading || companiesLoading || !deals || !companies) return '...';
        const deal = deals.find(d => d.id === dealId);
        if (!deal) return 'N/A';
        const company = companies.find(c => c.id === deal.company_id);
        return company?.name || 'N/A';
    }
    
    const toDate = (dateValue: any): Date => {
        if (!dateValue) return new Date();
        if (dateValue instanceof Date) return dateValue;
        if (dateValue instanceof Timestamp) return dateValue.toDate();
        if (typeof dateValue === 'string') return new Date(dateValue);
        if (dateValue && typeof dateValue.seconds === 'number') {
            return new Date(dateValue.seconds * 1000);
        }
        return new Date();
    };

  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
            <PianoIcon className="h-7 w-7" />
            Orchestrator
          </h1>
          <p className="text-muted-foreground">An immutable audit trail of all automated and manual actions.</p>
        </div>

        {/* Scheduled Emails Card */}
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Mail /> Scheduled Emails</CardTitle>
                <CardDescription>Emails drafted or scheduled by the system or user.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Scheduled At</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Actor</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logsLoading && <TableRow><TableCell colSpan={4} className="text-center">Loading history...</TableCell></TableRow>}
                    {!logsLoading && scheduledEmails.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No scheduled emails found.</TableCell></TableRow>}
                    {scheduledEmails.map((log) => (
                    <TableRow key={log.id}>
                        <TableCell>{log.ts ? format(toDate(log.ts), "MMM d, yyyy, h:mm a") : 'N/A'}</TableCell>
                        <TableCell>{log.after_snapshot?.to}</TableCell>
                        <TableCell className="font-medium">{log.after_snapshot?.subject}</TableCell>
                        <TableCell><Badge variant={actorVariant[log.actor_type] || 'secondary'}>{log.actor_type}</Badge></TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </CardContent>
        </Card>

        {/* Scheduled Meetings Card */}
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Calendar /> Scheduled Meetings</CardTitle>
                <CardDescription>Meetings created by the system or user.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Proposed Time</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Participants</TableHead>
                        <TableHead>Related Deal</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {logsLoading && <TableRow><TableCell colSpan={4} className="text-center">Loading history...</TableCell></TableRow>}
                    {!logsLoading && scheduledMeetings.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No scheduled meetings found.</TableCell></TableRow>}
                    {scheduledMeetings.map((log) => (
                    <TableRow key={log.id}>
                        <TableCell>{log.after_snapshot?.proposed_time ? format(toDate(log.after_snapshot.proposed_time), "MMM d, yyyy, h:mm a") : 'N/A'}</TableCell>
                        <TableCell className="font-medium">{log.after_snapshot?.title}</TableCell>
                        <TableCell className="text-xs">{log.after_snapshot?.participants?.join(', ')}</TableCell>
                        <TableCell>{log.after_snapshot?.deal_id || 'N/A'}</TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </CardContent>
        </Card>

        {/* Status Updates Card */}
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingUp /> Status Updates</CardTitle>
                <CardDescription>All deal stage updates are recorded here.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Update At</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Deal</TableHead>
                        <TableHead>Company</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(logsLoading || dealsLoading || companiesLoading) && <TableRow><TableCell colSpan={4} className="text-center">Loading updates...</TableCell></TableRow>}
                    {!logsLoading && dealUpdates.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No deal updates found.</TableCell></TableRow>}
                    {dealUpdates.map((log) => (
                    <TableRow key={log.id}>
                        <TableCell>{log.ts ? format(toDate(log.ts), "MMM d, yyyy, h:mm a") : 'N/A'}</TableCell>
                        <TableCell className="font-medium">
                            {`Update deal to '${log.after_snapshot?.stage}' stage`}
                        </TableCell>
                        <TableCell>{log.before_snapshot?.title || 'N/A'}</TableCell>
                        <TableCell>{getCompanyNameForDeal(log.entity_id)}</TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </CardContent>
        </Card>


        {/* General Data Changes Card */}
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Database /> General Data Changes</CardTitle>
                <CardDescription>All other create, update, and delete actions are recorded here.</CardDescription>
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
                    {!logsLoading && generalLogs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No other activity found.</TableCell></TableRow>}
                    {generalLogs.map((log) => (
                    <TableRow key={log.id}>
                        <TableCell>{log.ts ? format(toDate(log.ts), "MMM d, yyyy, h:mm a") : 'N/A'}</TableCell>
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
