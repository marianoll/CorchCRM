
'use client';

import { useState, useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useUser } from '@/firebase/auth/use-user';
import { db } from '@/firebase/client';
import { collection, orderBy, query, Timestamp } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Calendar, TrendingUp, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CrmDetailsDialog } from '@/components/crm-details-dialog';


type AuditLog = {
    id: string;
    ts: string;
    actor_type: 'user' | 'system_ai' | 'system_job';
    action: 'create' | 'update' | 'delete' | 'restore' | 'create_meeting' | 'create_task' | 'send_email';
    entity_type: string;
    entity_id: string;
    table: string;
    after_snapshot?: any;
    before_snapshot?: any;
};

// Define types based on new schema
type Company = {
    id: string;
    name: string;
    domain?: string;
    industry?: string;
};

type Contact = {
    id: string;
    company_id?: string;
    full_name: string;
    email_primary: string;
    phone?: string;
    title?: string;
};

type Deal = {
    id: string;
    company_id?: string;
    primary_contact_id: string;
    title: string;
    amount: number;
    stage: string;
    close_date: Date | Timestamp | string;
};

type Email = {
    id: string;
    ts: string | Timestamp;
    from_email: string;
    to_email: string;
    direction: 'inbound' | 'outbound';
    subject: string;
    body_excerpt: string;
    labels: string;
    company_id?: string;
    deal_id?: string;
    ai_summary?: string;
};

type CrmEntity = Company | Contact | Deal;


const actorVariant: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
  user: 'default',
  system_ai: 'secondary',
  system_job: 'secondary',
};

export default function OrquestratorPage() {
    const { user } = useUser();

    // Details Dialog state
    const [detailsEntity, setDetailsEntity] = useState<CrmEntity | null>(null);
    const [detailsEntityType, setDetailsEntityType] = useState<'Company' | 'Contact' | 'Deal' | null>(null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

    const logsQuery = useMemo(() => 
        user ? query(collection(db, 'audit_logs'), orderBy('ts', 'desc')) : null
    , [user]);

    const dealsQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'deals')) : null, [user]);
    const companiesQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'companies')) : null, [user]);
    const contactsQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'contacts')) : null, [user]);
    const emailsQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'emails')) : null, [user]);

    const { data: logs, loading: logsLoading } = useCollection<AuditLog>(logsQuery);
    const { data: deals, loading: dealsLoading } = useCollection<Deal>(dealsQuery);
    const { data: companies, loading: companiesLoading } = useCollection<Company>(companiesQuery);
    const { data: contacts, loading: contactsLoading } = useCollection<Contact>(contactsQuery);
    const { data: emails, loading: emailsLoading } = useCollection<Email>(emailsQuery);
    
    const scheduledEmails = useMemo(() => logs?.filter(log => log.action === 'send_email') || [], [logs]);
    const scheduledMeetings = useMemo(() => logs?.filter(log => log.action === 'create_meeting') || [], [logs]);
    const dealUpdates = useMemo(() => logs?.filter(log => log.entity_type === 'deals' && log.action === 'update') || [], [logs]);
    
    const getDeal = (dealId: string) => {
        if (dealsLoading || !deals) return null;
        return deals.find(d => d.id === dealId) || null;
    }

    const getCompany = (companyId: string) => {
        if (companiesLoading || !companies) return null;
        return companies.find(c => c.id === companyId) || null;
    }

    const handleEntityClick = (entity: CrmEntity, type: 'Company' | 'Contact' | 'Deal') => {
        setDetailsEntity(entity);
        setDetailsEntityType(type);
        setIsDetailsDialogOpen(true);
    };

    const getCompanyNameForDeal = (dealId: string) => {
        const deal = getDeal(dealId);
        if (!deal || !deal.company_id) return { id: '', name: 'N/A' };
        const company = getCompany(deal.company_id);
        return company ? { id: company.id, name: company.name } : { id: '', name: 'N/A' };
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
    <>
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
            <Inbox className="h-7 w-7" />
            Zero-Click Inbox
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
                <div className="max-h-80 overflow-y-auto">
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
                </div>
            </CardContent>
        </Card>

        {/* Scheduled Meetings Card */}
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Calendar /> Scheduled Meetings</CardTitle>
                <CardDescription>Meetings created by the system or user.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="max-h-80 overflow-y-auto">
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
                        {scheduledMeetings.map((log) => {
                            const deal = getDeal(log.after_snapshot?.deal_id);
                            return (
                                <TableRow key={log.id}>
                                    <TableCell>{log.after_snapshot?.proposed_time ? format(toDate(log.after_snapshot.proposed_time), "MMM d, yyyy, h:mm a") : 'N/A'}</TableCell>
                                    <TableCell className="font-medium">{log.after_snapshot?.title}</TableCell>
                                    <TableCell className="text-xs">{log.after_snapshot?.participants?.join(', ')}</TableCell>
                                    <TableCell>
                                        {deal ? (
                                             <Button variant="link" className="p-0 h-auto" onClick={() => handleEntityClick(deal, 'Deal')}>
                                                {deal.title}
                                            </Button>
                                        ) : (log.after_snapshot?.deal_id || 'N/A')}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>

        {/* Status Updates Card */}
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><TrendingUp /> Status Updates</CardTitle>
                <CardDescription>All deal stage updates are recorded here.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="max-h-80 overflow-y-auto">
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
                        {dealUpdates.map((log) => {
                            const company = getCompany(getCompanyNameForDeal(log.entity_id).id);
                            const deal = getDeal(log.entity_id);
                            return (
                                <TableRow key={log.id}>
                                    <TableCell>{log.ts ? format(toDate(log.ts), "MMM d, yyyy, h:mm a") : 'N/A'}</TableCell>
                                    <TableCell className="font-medium">
                                        {`Update deal to '${log.after_snapshot?.stage}' stage`}
                                    </TableCell>
                                    <TableCell>
                                        {deal ? (
                                            <Button variant="link" className="p-0 h-auto" onClick={() => handleEntityClick(deal, 'Deal')}>
                                                {log.before_snapshot?.title || 'N/A'}
                                            </Button>
                                        ) : (log.before_snapshot?.title || 'N/A')}
                                    </TableCell>
                                    <TableCell>
                                        {company && company.name !== 'N/A' ? (
                                            <Button variant="link" className="p-0 h-auto" onClick={() => handleEntityClick(company, 'Company')}>
                                                {company.name}
                                            </Button>
                                        ) : (company?.name || 'N/A')}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
      </div>
    </main>
    <CrmDetailsDialog
        entity={detailsEntity}
        entityType={detailsEntityType}
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        onEntityClick={handleEntityClick}
        contacts={contacts || []}
        deals={deals || []}
        emails={emails || []}
    />
    </>
  );
}
