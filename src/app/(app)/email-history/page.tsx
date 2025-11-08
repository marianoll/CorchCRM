'use client';

import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, orderBy, query, writeBatch, doc, Timestamp } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Mail, ArrowRight, Database, LoaderCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';


type Email = {
    id: string;
    ts: string | Timestamp;
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
    const { toast } = useToast();
    const [isSeeding, setIsSeeding] = useState(false);

    const emailsQuery = useMemoFirebase(() => 
        firestore && user
        ? query(collection(firestore, 'users', user.uid, 'emails'), orderBy('ts', 'desc')) 
        : null, 
    [firestore, user]);

    const { data: emails, loading: emailsLoading } = useCollection<Email>(emailsQuery);

    const handleSeedEmails = async () => {
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Firestore or user not available.' });
            return;
        }
        setIsSeeding(true);
        toast({ title: 'Seeding Emails...', description: 'Please wait while we populate your email history.' });

        try {
            const batch = writeBatch(firestore);

            const emailsRes = await fetch('/emails_seed.csv');
            const emailsCsv = await emailsRes.text();

            const parseCsv = (csvText: string): Record<string, string>[] => {
                const lines = csvText.trim().replace(/\r/g, '').split('\n');
                if (lines.length < 2) return [];
                const headerLine = lines.shift();
                if (!headerLine) return [];
                const headers = headerLine.split(',');

                return lines.map(line => {
                    if (!line.trim()) return null;
                    const values = line.split(',');
                    const obj: Record<string, string> = {};
                    headers.forEach((header, index) => {
                        obj[header] = values[index];
                    });
                    return obj;
                }).filter((obj): obj is Record<string, string> => obj !== null);
            };

            const emailsData = parseCsv(emailsCsv);
            emailsData.forEach(emailObj => {
                if (emailObj.id) {
                    const emailRef = doc(firestore, 'users', user.uid, 'emails', emailObj.id);
                    const emailData: any = { ...emailObj };
                    if (emailData.ts && !isNaN(new Date(emailData.ts).getTime())) {
                      emailData.ts = new Date(emailData.ts);
                    } else {
                      delete emailData.ts; // Remove invalid date
                    }
                    batch.set(emailRef, emailData);
                }
            });
            
            await batch.commit();

            toast({ title: 'Email Database Seeded!', description: 'Your email history has been populated with sample data.' });
        } catch (error) {
            console.error("Seeding error:", error);
            toast({ variant: 'destructive', title: 'Seeding Failed', description: 'Could not populate the email data. Check console for details.' });
        } finally {
            setIsSeeding(false);
        }
    };

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

    const renderLabels = (labels: string) => {
        if (!labels) return null;
        return labels.split(';').map(label => (
            <Badge key={label} variant="outline" className="mr-1 mb-1">{label}</Badge>
        ));
    };

  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
                    <Mail className="h-7 w-7" />
                    Email History
                </h1>
                <p className="text-muted-foreground">A log of all emails processed by the system.</p>
            </div>
             <Button onClick={handleSeedEmails} disabled={isSeeding}>
                {isSeeding ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                 Seed Database
            </Button>
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
                        <TableCell>{email.ts ? format(toDate(email.ts), "MMM d, yyyy, h:mm a") : 'No date'}</TableCell>
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
