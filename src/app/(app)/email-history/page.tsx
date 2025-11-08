'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, orderBy, query, writeBatch, doc, Timestamp } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Mail, ArrowRight, Database, LoaderCircle, Zap, Calendar as CalendarIcon, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

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
};

type Company = {
    id: string;
    name: string;
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

    // Filter states
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [selectedCompany, setSelectedCompany] = useState<string>('all');
    const [labelFilter, setLabelFilter] = useState<string>('');

    const emailsQuery = useMemoFirebase(() => 
        firestore && user
        ? query(collection(firestore, 'users', user.uid, 'emails'), orderBy('ts', 'desc')) 
        : null, 
    [firestore, user]);

    const companiesQuery = useMemoFirebase(() => 
        firestore && user
        ? query(collection(firestore, 'users', user.uid, 'companies'))
        : null,
    [firestore, user]);

    const { data: emails, loading: emailsLoading } = useCollection<Email>(emailsQuery);
    const { data: companies, loading: companiesLoading } = useCollection<Company>(companiesQuery);

    const getCompanyName = (companyId?: string) => {
        if (!companyId || companiesLoading || !companies) return 'N/A';
        return companies.find(c => c.id === companyId)?.name || 'Unknown';
    }

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

    const filteredEmails = useMemo(() => {
        if (!emails) return [];
        return emails.filter(email => {
            const emailDate = toDate(email.ts);
            const isDateMatch = selectedDate ? format(emailDate, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd') : true;
            const isCompanyMatch = selectedCompany === 'all' || email.company_id === selectedCompany;
            const isLabelMatch = labelFilter ? (email.labels || '').toLowerCase().includes(labelFilter.toLowerCase()) : true;
            return isDateMatch && isCompanyMatch && isLabelMatch;
        });
    }, [emails, selectedDate, selectedCompany, labelFilter]);


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

        <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-card border rounded-lg">
            <h3 className="text-sm font-medium mr-2">Filters:</h3>
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    variant={"outline"}
                    className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "PPP") : <span>Pick a date</span>}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                />
                </PopoverContent>
            </Popover>

            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by company" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companies?.map(company => (
                        <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <div className="relative w-full sm:w-auto">
                 <Input
                    placeholder="Filter by labels..."
                    value={labelFilter}
                    onChange={(e) => setLabelFilter(e.target.value)}
                    className="w-full sm:w-[200px] pr-8"
                />
                {labelFilter && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setLabelFilter('')}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
           
            {(selectedDate || selectedCompany !== 'all' || labelFilter) && (
                <Button variant="ghost" onClick={() => {
                    setSelectedDate(undefined);
                    setSelectedCompany('all');
                    setLabelFilter('');
                }}>
                    Clear Filters
                </Button>
            )}
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
                        <TableHead>Company</TableHead>
                        <TableHead>AI Summary</TableHead>
                        <TableHead>Labels</TableHead>
                        <TableHead className="w-[80px]">Action</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(emailsLoading || companiesLoading) && <TableRow><TableCell colSpan={7} className="text-center">Loading emails...</TableCell></TableRow>}
                    {!emailsLoading && filteredEmails.length === 0 && <TableRow><TableCell colSpan={7} className="text-center">No emails found.</TableCell></TableRow>}
                    {filteredEmails.map((email) => (
                    <TableRow key={email.id}>
                        <TableCell>{email.ts ? format(toDate(email.ts), "MMM d, yyyy, h:mm a") : 'No date'}</TableCell>
                        <TableCell className="font-medium">
                           <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="link" className="p-0 h-auto font-medium text-left">{email.subject}</Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-2xl">
                                    <DialogHeader>
                                        <DialogTitle>{email.subject}</DialogTitle>
                                        <DialogDescription>
                                            {email.from_email} to {email.to_email}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto">
                                        <p>{email.body_excerpt}</p>
                                    </div>
                                    <DialogFooter>
                                        <Button type="button" variant="secondary">Close</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </TableCell>
                        <TableCell>
                            <div className="flex flex-col text-xs">
                                <Badge variant={directionVariant[email.direction]} className="mb-1 w-fit">{email.direction}</Badge>
                                <span className='text-muted-foreground'>From: {email.from_email}</span>
                                <span className='text-muted-foreground'>To: {email.to_email}</span>
                            </div>
                        </TableCell>
                        <TableCell>{getCompanyName(email.company_id)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground italic line-clamp-2">{email.body_excerpt}</TableCell>
                        <TableCell>
                            {email.labels && <div className="flex flex-wrap">{renderLabels(email.labels)}</div>}
                        </TableCell>
                        <TableCell>
                            <Button variant="ghost" size="icon" title="Automate">
                                <Zap className="h-4 w-4" />
                            </Button>
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
