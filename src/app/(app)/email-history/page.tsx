'use client';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, orderBy, query } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Mail, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Email = {
    id: string;
    ts: string;
    from_email: string;
    to_email: string;
    direction: 'inbound' | 'outbound';
    subject: string;
    body_excerpt: string;
    labels: string;
};

const directionVariant: { [key: string]: 'default' | 'secondary' } = {
  inbound: 'default',
  outbound: 'secondary',
};

export default function EmailHistoryPage() {
    const firestore = useFirestore();
    const { user } = useUser();

    const emailsQuery = useMemoFirebase(() => 
        firestore && user
        ? query(collection(firestore, 'users', user.uid, 'emails'), orderBy('ts', 'desc')) 
        : null, 
    [firestore, user]);

    const { data: emails, loading: emailsLoading } = useCollection<Email>(emailsQuery);

    const renderLabels = (labels: string) => {
        return labels.split(';').map(label => (
            <Badge key={label} variant="outline" className="mr-1 mb-1">{label}</Badge>
        ));
    };

  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
            <Mail className="h-7 w-7" />
            Email History
          </h1>
          <p className="text-muted-foreground">A log of all emails processed by the system.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Email Logs</CardTitle>
                <CardDescription>All emails synced or processed by the AI will appear here.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[180px]">Timestamp</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>From/To</TableHead>
                        <TableHead>Labels</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {emailsLoading && <TableRow><TableCell colSpan={4} className="text-center">Loading emails...</TableCell></TableRow>}
                    {!emailsLoading && emails?.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No emails found.</TableCell></TableRow>}
                    {emails?.map((email) => (
                    <TableRow key={email.id}>
                        <TableCell>{format(new Date(email.ts), "MMM d, yyyy, h:mm a")}</TableCell>
                        <TableCell>
                            <div className='flex flex-col'>
                                <span className='font-medium'>{email.subject}</span>
                                <span className='text-xs text-muted-foreground line-clamp-1'>{email.body_excerpt}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex items-center gap-2 text-xs">
                                <Badge variant={directionVariant[email.direction]}>{email.direction}</Badge>
                                <span>{email.from_email}</span>
                                <ArrowRight className="h-3 w-3" />
                                <span>{email.to_email}</span>
                            </div>
                        </TableCell>
                        <TableCell>
                            {email.labels && <div className="flex flex-wrap">{renderLabels(email.labels)}</div>}
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

    