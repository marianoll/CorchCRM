
'use client';

import { useState, useMemo, useCallback } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, orderBy, query, doc, setDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format, isWithinInterval } from 'date-fns';
import { Mail, Database, LoaderCircle, Calendar as CalendarIcon, RefreshCw, FileText, Sparkles, Gem, MailPlus } from 'lucide-react';
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
import { DateRange } from 'react-day-picker';
import { summarizeText } from '@/ai/flows/summarize-text';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { CrmDetailsDialog } from '@/components/crm-details-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { syncGmail } from '@/ai/flows/sync-gmail-flow';
import { OrchestratorSuggestionDialog } from '@/components/orchestrator-suggestion-dialog';
import { orchestrateInteraction, type OrchestratorOutput, type Interaction } from '@/ai/flows/orchestrator-flow';


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

type Company = { id: string; name: string; domain?: string; industry?: string; };
type Contact = { id: string; company_id?: string; full_name: string; email_primary: string; phone?: string; title?: string; };
type Deal = { id: string; company_id?: string; primary_contact_id: string; title: string; amount: number; stage: string; close_date: Date | Timestamp | string; };
type CrmEntity = Company | Contact | Deal;


const directionVariant: { [key: string]: 'default' | 'secondary' } = {
  inbound: 'default',
  outbound: 'secondary',
};

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


export default function EmailHistoryPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isSeeding, setIsSeeding] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [summarizingId, setSummarizingId] = useState<string | null>(null);
    const [isSummarizingAll, setIsSummarizingAll] = useState(false);

    // Filters state
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [selectedCompany, setSelectedCompany] = useState<string>('all');
    const [labelFilter, setLabelFilter] = useState<string>('');
    const [keywordFilter, setKeywordFilter] = useState<string>('');
    const [contactFilter, setContactFilter] = useState<string>('');
    
    // Details Dialog state
    const [detailsEntity, setDetailsEntity] = useState<CrmEntity | null>(null);
    const [detailsEntityType, setDetailsEntityType] = useState<'Company' | 'Contact' | 'Deal' | null>(null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

    // Orchestrator Dialog state
    const [isOrchestratorDialogOpen, setIsOrchestratorDialogOpen] = useState(false);
    const [selectedEmailForOrchestrator, setSelectedEmailForOrchestrator] = useState<Email | null>(null);


    // Data fetching
    const emailsQuery = useMemoFirebase(() => query(collection(firestore, 'users', user.uid, 'emails'), orderBy('ts', 'desc')), []);
    const { data: emails, loading: emailsLoading, setData: setEmails } = useCollection<Email>(emailsQuery);

    const companiesQuery = useMemoFirebase(() => query(collection(firestore, 'users', user.uid, 'companies')), []);
    const { data: companies, loading: companiesLoading } = useCollection<Company>(companiesQuery);

    const contactsQuery = useMemoFirebase(() => query(collection(firestore, 'users', user.uid, 'contacts')), []);
    const { data: contacts, loading: contactsLoading } = useCollection<Contact>(contactsQuery);

    const dealsQuery = useMemoFirebase(() => query(collection(firestore, 'users', user.uid, 'deals')), []);
    const { data: deals, loading: dealsLoading } = useCollection<Deal>(dealsQuery);

    const crmDataLoading = companiesLoading || contactsLoading || dealsLoading;

    const getCompanyName = (companyId?: string) => {
        if (!companyId || companiesLoading || !companies) return null;
        return companies.find(c => c.id === companyId);
    }
    
    const getDealTitle = (dealId?: string) => {
        if (!dealId || dealsLoading || !deals) return null;
        return deals.find(d => d.id === dealId);
    }
    
    const handleEntityClick = (entity: CrmEntity, type: 'Company' | 'Contact' | 'Deal') => {
        setDetailsEntity(entity);
        setDetailsEntityType(type);
        setIsDetailsDialogOpen(true);
    };

    const handleSyncGmail = async () => {
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'User not logged in.' });
            return;
        }
        setIsSyncing(true);
        toast({ title: 'Syncing Gmail...', description: 'Fetching today\'s emails.' });

        try {
            const result = await syncGmail({ userId: user.uid });

            if (result.success && result.emails.length > 0) {
                const batch = writeBatch(firestore);
                result.emails.forEach(email => {
                    const emailRef = doc(collection(firestore, 'users', user.uid, 'emails'));
                    batch.set(emailRef, {
                        ...email,
                        id: emailRef.id,
                        ts: new Date(email.ts as string), // Convert string timestamp back to Date
                    });
                });
                await batch.commit();
                toast({
                    title: 'Sync Complete!',
                    description: `${result.emails.length} new email(s) have been added.`,
                });
            } else if (result.success) {
                 toast({
                    title: 'No new emails',
                    description: 'Your email history is already up to date.',
                });
            } else {
                throw new Error(result.message);
            }
        } catch (error: any) {
            console.error("Gmail sync error:", error);
            toast({ variant: 'destructive', title: 'Sync Failed', description: error.message || 'Could not sync emails from Gmail.' });
        } finally {
            setIsSyncing(false);
        }
    };


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
                const emailRef = doc(collection(firestore, 'users', user.uid, 'emails'));
                const emailData: any = { ...emailObj, id: emailRef.id };
                
                Object.keys(emailData).forEach(key => {
                    if (emailData[key] === undefined || emailData[key] === null || emailData[key] === '') {
                        delete emailData[key];
                    }
                });

                if (emailData.ts && !isNaN(new Date(emailData.ts).getTime())) {
                  emailData.ts = new Date(emailData.ts);
                } else {
                  delete emailData.ts; 
                }

                batch.set(emailRef, emailData);
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
            
            const isDateMatch = dateRange?.from ? isWithinInterval(emailDate, { start: dateRange.from, end: dateRange.to || dateRange.from }) : true;
            const isCompanyMatch = selectedCompany === 'all' || email.company_id === selectedCompany;
            const isLabelMatch = labelFilter ? (email.labels || '').toLowerCase().includes(labelFilter.toLowerCase()) : true;
            const isKeywordMatch = keywordFilter ? (email.subject.toLowerCase().includes(keywordFilter.toLowerCase()) || email.body_excerpt.toLowerCase().includes(keywordFilter.toLowerCase())) : true;
            const isContactMatch = contactFilter ? (email.from_email.toLowerCase().includes(contactFilter.toLowerCase()) || email.to_email.toLowerCase().includes(contactFilter.toLowerCase())) : true;
            
            return isDateMatch && isCompanyMatch && isLabelMatch && isKeywordMatch && isContactMatch;
        });
    }, [emails, dateRange, selectedCompany, labelFilter, keywordFilter, contactFilter]);


    const renderLabels = (labels: string) => {
        if (!labels) return null;
        return labels.split(';').map(label => (
            <Badge key={label} variant="outline" className="mr-1 mb-1">{label}</Badge>
        ));
    };

    const clearFilters = () => {
        setDateRange(undefined);
        setSelectedCompany('all');
        setLabelFilter('');
        setKeywordFilter('');
        setContactFilter('');
    }

    const handleSummarizeOne = async (emailId: string, text: string) => {
        if (!text) {
            toast({ variant: 'destructive', title: 'No Content', description: 'Email body is empty, cannot summarize.' });
            return;
        }
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Firestore or user not available.' });
            return;
        }

        setSummarizingId(emailId);
        try {
            const result = await summarizeText({ text });
            
            const emailRef = doc(firestore, 'users', user.uid, 'emails', emailId);
            const summaryData = { ai_summary: result.summary };

            setDoc(emailRef, summaryData, { merge: true }).catch(error => {
                const permissionError = new FirestorePermissionError({ path: emailRef.path, operation: 'update', requestResourceData: summaryData });
                errorEmitter.emit('permission-error', permissionError);
                throw error;
            });
            
            if (setEmails) {
                 setEmails(prevEmails => {
                    if (!prevEmails) return null;
                    return prevEmails.map(e => e.id === emailId ? { ...e, ai_summary: result.summary } : e);
                });
            }

            toast({ title: 'Summary Generated!', description: 'AI summary has been saved.' });
        } catch (err: any) {
            // Error is already emitted, toast is a fallback if emission fails.
             if (!(err instanceof FirestorePermissionError)) {
                 toast({ variant: 'destructive', title: 'AI Error', description: err.message || 'Could not generate or save summary.' });
            }
        } finally {
            setSummarizingId(null);
        }
    };
    
    const handleSummarizeAll = async () => {
        const emailsToSummarize = filteredEmails.filter(e => !e.ai_summary && e.body_excerpt);
        if (emailsToSummarize.length === 0) {
            toast({ title: 'All Caught Up!', description: 'No emails need summarizing.' });
            return;
        }
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Firestore or user not available.' });
            return;
        }

        setIsSummarizingAll(true);
        toast({ title: 'Summarizing All...', description: `Processing ${emailsToSummarize.length} emails.` });
        
        let successCount = 0;

        for (const email of emailsToSummarize) {
            setSummarizingId(email.id); // Show loader for current row
            try {
                const result = await summarizeText({ text: email.body_excerpt });
                const emailRef = doc(firestore, 'users', user.uid, 'emails', email.id);
                
                setDoc(emailRef, { ai_summary: result.summary }, { merge: true }).catch(err => {
                    console.warn(`Permission error summarizing email ${email.id}, skipping.`, err);
                });

                // Optimistically update UI state for this specific email
                if (setEmails) {
                    setEmails(prevEmails => {
                        if (!prevEmails) return null;
                        return prevEmails.map(e => e.id === email.id ? { ...e, ai_summary: result.summary } : e);
                    });
                }
                successCount++;
            } catch (err) {
                console.warn(`Could not summarize email ${email.id}. Skipping.`, err);
            } finally {
                setSummarizingId(null); // Hide loader for this row
            }
        }

        setIsSummarizingAll(false);
        toast({ title: 'Summaries Complete!', description: `${successCount} of ${emailsToSummarize.length} emails were summarized.` });
    };

    const handleOrchestrate = (email: Email) => {
        setSelectedEmailForOrchestrator(email);
        setIsOrchestratorDialogOpen(true);
    };

    const processOrchestration = useCallback(async (): Promise<OrchestratorOutput | null> => {
      if (!selectedEmailForOrchestrator || crmDataLoading) {
        toast({ variant: 'destructive', title: 'Data not ready', description: 'CRM data is still loading.' });
        return null;
      }

      // Interaction con direction + timestamp ISO
      const interaction: Interaction = {
        source: 'email',
        subject: selectedEmailForOrchestrator.subject,
        body: selectedEmailForOrchestrator.body_excerpt,
        from: selectedEmailForOrchestrator.from_email,
        to: selectedEmailForOrchestrator.to_email,
        timestamp: toDate(selectedEmailForOrchestrator.ts).toISOString(),
        // IMPORTANTE: dirección del correo para la lógica inbound/outbound
        direction: selectedEmailForOrchestrator.direction,
      };

      // Contexto enriquecido
      const company = getCompanyName(selectedEmailForOrchestrator.company_id || undefined);
      const deal    = getDealTitle(selectedEmailForOrchestrator.deal_id || undefined);
      const contact = contacts?.find(c =>
        c.email_primary === selectedEmailForOrchestrator.from_email ||
        c.email_primary === selectedEmailForOrchestrator.to_email
      );

      const related_entities: Record<string, any> = {
        company: company ? {
          id: company.id, name: company.name, domain: (company as any).domain, industry: (company as any).industry
        } : undefined,
        contact: contact ? {
          id: contact.id, full_name: contact.full_name, email: contact.email_primary, title: contact.title
        } : undefined,
        deal: deal ? {
          id: deal.id, title: deal.title, stage: deal.stage,
          amount: (deal as any).amount, probability: (deal as any).probability,
          owner_email: (deal as any).owner_email, close_date: (deal as any).close_date
        } : undefined
      };

      try {
        const result = await orchestrateInteraction({ interaction, related_entities });
        if (!result || !Array.isArray(result.actions)) {
          toast({ variant: 'destructive', title: 'Orchestrator error', description: 'No actions returned.' });
          return null;
        }

        // Opcional: feedback rápido si vino vacío (no debería por fallback)
        if (result.actions.length === 0) {
          toast({ title: 'No actions', description: 'No concrete actions were generated.' });
        }
        return result;
      } catch (err:any) {
        console.error('processOrchestration error', err);
        toast({ variant: 'destructive', title: 'AI Error', description: err?.message || 'Could not orchestrate this email.' });
        return null;
      }
    }, [selectedEmailForOrchestrator, contacts, companies, deals, crmDataLoading, toast, getCompanyName, getDealTitle]);


  return (
    <TooltipProvider>
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
            <div className="flex gap-2">
                <Button onClick={handleSyncGmail} disabled={isSyncing}>
                    {isSyncing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <MailPlus className="mr-2 h-4 w-4" />}
                    Sync Today's Gmail
                </Button>
                <Button onClick={handleSummarizeAll} disabled={isSummarizingAll}>
                    {isSummarizingAll ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Summarize All Missing
                </Button>
                <Button onClick={handleSeedEmails} disabled={isSeeding}>
                    {isSeeding ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                    Seed Database
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 items-start gap-4 mb-4 p-4 bg-card border rounded-lg">
            <h3 className="text-sm font-medium lg:col-span-5">Filters:</h3>
            <Popover>
                <PopoverTrigger asChild>
                <Button
                    id="date"
                    variant={"outline"}
                    className={cn(
                    "w-full justify-start text-left font-normal",
                    !dateRange && "text-muted-foreground"
                    )}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                    dateRange.to ? (
                        <>
                        {format(dateRange.from, "LLL dd, y")} -{" "}
                        {format(dateRange.to, "LLL dd, y")}
                        </>
                    ) : (
                        format(dateRange.from, "LLL dd, y")
                    )
                    ) : (
                    <span>Pick a date range</span>
                    )}
                </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                />
                </PopoverContent>
            </Popover>

            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger>
                    <SelectValue placeholder="Filter by company" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companies?.map(company => (
                        <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Input
                placeholder="Filter by from/to..."
                value={contactFilter}
                onChange={(e) => setContactFilter(e.target.value)}
            />
            <Input
                placeholder="Filter by keyword..."
                value={keywordFilter}
                onChange={(e) => setKeywordFilter(e.target.value)}
            />
             <Input
                placeholder="Filter by label..."
                value={labelFilter}
                onChange={(e) => setLabelFilter(e.target.value)}
            />
           
            <div className="lg:col-span-5 flex flex-wrap gap-2 items-center">
                 {(dateRange || selectedCompany !== 'all' || labelFilter || keywordFilter || contactFilter) && (
                    <Button variant="ghost" onClick={clearFilters}>
                        Clear Filters
                    </Button>
                )}
            </div>
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
                        <TableHead className="w-[20%]">Subject</TableHead>
                        <TableHead>From/To</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Deal</TableHead>
                        <TableHead className="w-[35%]">AI Summary</TableHead>
                        <TableHead>Labels</TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(emailsLoading || crmDataLoading) && <TableRow><TableCell colSpan={8} className="text-center">Loading emails...</TableCell></TableRow>}
                    {!emailsLoading && filteredEmails.length === 0 && <TableRow><TableCell colSpan={8} className="text-center">No emails found.</TableCell></TableRow>}
                    {filteredEmails.map((email) => {
                        const company = getCompanyName(email.company_id);
                        const deal = getDealTitle(email.deal_id);
                        return (
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
                                <Tooltip>
                                    <TooltipTrigger>
                                         <Badge variant={directionVariant[email.direction]} className="mb-1 w-fit">{email.direction}</Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <div className="flex flex-col text-xs p-1">
                                            <span>From: {email.from_email}</span>
                                            <span>To: {email.to_email}</span>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TableCell>
                            <TableCell>
                                {company ? (
                                    <Button variant="link" className="p-0 h-auto" onClick={() => handleEntityClick(company, 'Company')}>{company.name}</Button>
                                ) : 'N/A'}
                            </TableCell>
                            <TableCell>
                                {deal ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                             <Button variant="ghost" size="icon" onClick={() => handleEntityClick(deal, 'Deal')}>
                                                <FileText className="h-4 w-4" />
                                                <span className="sr-only">View Deal</span>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{deal.title}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                ) : 'N/A'}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                {summarizingId === email.id ? (
                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                ) : email.ai_summary ? (
                                    <span className="text-sm">{email.ai_summary}</span>
                                ) : (
                                    <>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleSummarizeOne(email.id, email.body_excerpt)}
                                                    disabled={isSummarizingAll}
                                                    className="h-6 w-6 shrink-0"
                                                >
                                                    <RefreshCw className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Generate AI Summary</p>
                                            </TooltipContent>
                                        </Tooltip>
                                        <span className="text-xs text-muted-foreground italic line-clamp-2">
                                            {email.body_excerpt}
                                        </span>
                                    </>
                                )}
                                </div>
                            </TableCell>
                            <TableCell>
                                {email.labels && <div className="flex flex-wrap">{renderLabels(email.labels)}</div>}
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-1">
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => handleOrchestrate(email)}>
                                                <Gem className="h-4 w-4" />
                                                <span className="sr-only">Orchestrate</span>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Orchestrate</p></TooltipContent>
                                    </Tooltip>
                                </div>
                            </TableCell>
                        </TableRow>
                    )})}
                </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
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
       {selectedEmailForOrchestrator && (
        <OrchestratorSuggestionDialog
            open={isOrchestratorDialogOpen}
            onOpenChange={setIsOrchestratorDialogOpen}
            email={selectedEmailForOrchestrator}
            processFunction={processOrchestration}
        />
      )}
    </main>
    </TooltipProvider>
  );
}
