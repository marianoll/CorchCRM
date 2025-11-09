
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useUser } from '@/firebase/auth/use-user';
import { db } from '@/firebase/client';
import { collection, orderBy, query, doc, setDoc, writeBatch, Timestamp, getDocs } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format, isWithinInterval, addDays } from 'date-fns';
import { Mail, Database, LoaderCircle, Calendar as CalendarIcon, FileText, Sparkles, MailPlus, CalendarPlus, TrendingUp, Bot, CheckCircle, Filter, FilterX } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
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
import { orchestrateInteraction, type OrchestratorOutput, type Interaction, type Action } from '@/ai/flows/orchestrator-flow';
import { EmailReplyDialog } from '@/components/email-reply-dialog';
import { AnalyzeEmailDialog } from '@/components/analyze-email-dialog';
import { analyzeEmailContent, type AnalysisOutput } from '@/ai/flows/analyze-email-flow';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';

type ActionStatus = 'approved' | 'rejected' | 'pending' | null;
type ActionType = 'reply' | 'analyze' | 'meeting' | 'task' | 'create_task' | 'stage_change' | 'data_update' | 'create_meeting';

type AIAction = {
    id: string;
    type: ActionType;
    description: string;
    details: any; // JSON blob
    status: ActionStatus;
}

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
    actionStates?: Partial<Record<ActionType, ActionStatus>>;
    actions?: AIAction[];
};

type Company = { id: string; name: string; domain?: string; industry?: string; };
type Contact = { id: string; company_id?: string; full_name: string; email_primary: string; phone?: string; title?: string; };
type Deal = { id: string; company_id?: string; primary_contact_id: string; title: string; amount: number; stage: string; close_date: Date | Timestamp | string; };
type CrmEntity = Company | Contact | Deal;


const directionVariant: { [key: string]: 'default' | 'secondary' } = {
  inbound: 'default',
  outbound: 'secondary',
};

const actionTypeMapping: Record<string, ActionType> = {
    create_task: 'task',
    stage_change: 'analyze',
    data_update: 'analyze',
    create_meeting: 'meeting',
};

export default function EmailHistoryPage() {
    const { user } = useUser();
    const { toast } = useToast();
    const [isSeeding, setIsSeeding] = useState(false);
    const [isSeeded, setIsSeeded] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [summarizingId, setSummarizingId] = useState<string | null>(null);
    const [isSummarizingAll, setIsSummarizingAll] = useState(false);
    const [processingActionsId, setProcessingActionsId] = useState<string | null>(null);

    // Bulk actions loading state
    const [isApprovingReplies, setIsApprovingReplies] = useState(false);
    const [isUpgradingDeals, setIsUpgradingDeals] = useState(false);
    const [isApprovingMeetings, setIsApprovingMeetings] = useState(false);

    // Filters state
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [selectedCompany, setSelectedCompany] = useState<string>('all');
    const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
    const [selectedDirections, setSelectedDirections] = useState<string[]>([]);
    
    // Details Dialog state
    const [detailsEntity, setDetailsEntity] = useState<CrmEntity | null>(null);
    const [detailsEntityType, setDetailsEntityType] = useState<'Company' | 'Contact' | 'Deal' | null>(null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

    // Reply Dialog state
    const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false);
    const [selectedEmailForReply, setSelectedEmailForReply] = useState<Email | null>(null);

    // Analyze Dialog state
    const [isAnalyzeDialogOpen, setIsAnalyzeDialogOpen] = useState(false);
    const [selectedEmailForAnalysis, setSelectedEmailForAnalysis] = useState<Email | null>(null);

    // Meeting Dialog state
    const [isMeetingDialogOpen, setIsMeetingDialogOpen] = useState(false);
    const [selectedEmailForMeeting, setSelectedEmailForMeeting] = useState<Email | null>(null);
    const [meetingDate, setMeetingDate] = useState<Date | undefined>(undefined);
    const [meetingTime, setMeetingTime] = useState<string>('10:00');

    // Orchestrator Dialog State
    const [isOrchestratorOpen, setIsOrchestratorOpen] = useState(false);
    const [selectedEmailForOrchestration, setSelectedEmailForOrchestration] = useState<Email | null>(null);


    // Data fetching
    const emailsQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'emails'), orderBy('ts', 'desc')) : null, [user]);
    const { data: emails, loading: emailsLoading, setData: setEmails } = useCollection<Email>(emailsQuery);

    useEffect(() => {
        if (!user || !emails) return;

        const fetchAllActions = async () => {
            if (!emails) return;
            const emailsWithActions = await Promise.all(
                emails.map(async (email) => {
                    if (email.actions) return email; // Actions already fetched
                    const actionsQuery = query(collection(db, 'users', user.uid, 'emails', email.id, 'actions'));
                    const actionsSnapshot = await getDocs(actionsQuery);
                    const actions = actionsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AIAction));
                    return { ...email, actions };
                })
            );
            setEmails(emailsWithActions);
        };
        fetchAllActions();
    // We only want to run this when the initial emails are loaded, not when we update them with actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [emails?.length, user]);


    const companiesQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'companies')) : null, [user]);
    const { data: companies, loading: companiesLoading } = useCollection<Company>(companiesQuery);

    const contactsQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'contacts')) : null, [user]);
    const { data: contacts, loading: contactsLoading } = useCollection<Contact>(contactsQuery);

    const dealsQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'deals')) : null, [user]);
    const { data: deals, loading: dealsLoading } = useCollection<Deal>(dealsQuery);

    const crmDataLoading = companiesLoading || contactsLoading || dealsLoading;
    
    const setActionState = (emailId: string, action: ActionType, status: ActionStatus) => {
        if (!db || !user) return;
        const emailRef = doc(db, 'users', user.uid, 'emails', emailId);
        const updateData = { [`actionStates.${action}`]: status };

        setDoc(emailRef, updateData, { merge: true }).catch(error => {
            console.error("Failed to update action state", error);
            // Optionally emit a global error or show a toast
        });
        
        // Optimistic UI update
        if (setEmails) {
            setEmails(prevEmails => {
                if (!prevEmails) return null;
                return prevEmails.map(e => {
                    if (e.id === emailId) {
                        return { ...e, actionStates: { ...e.actionStates, [action]: status } };
                    }
                    return e;
                });
            });
        }
    };

    const getCompanyName = (companyId?: string) => {
        if (!companyId || companiesLoading || !companies) return null;
        return companies.find(c => c.id === companyId);
    }
    
    const getDeal = (dealId?: string) => {
        if (!dealId || dealsLoading || !deals) return null;
        return deals.find(d => d.id === dealId);
    }
    
    const handleEntityClick = (entity: CrmEntity, type: 'Company' | 'Contact' | 'Deal') => {
        setDetailsEntity(entity);
        setDetailsEntityType(type);
        setIsDetailsDialogOpen(true);
    };

    const handleGenerateAiActions = async () => {
        if (!user || !filteredEmails || filteredEmails.length === 0) {
            toast({ title: 'No emails to process.' });
            return;
        }

        toast({ title: 'Generating AI Actions...', description: `Processing ${filteredEmails.length} emails.`});

        for (const email of filteredEmails) {
            setProcessingActionsId(email.id);
            try {
                const interaction: Interaction = {
                    source: 'email',
                    direction: email.direction,
                    subject: email.subject,
                    body: email.body_excerpt,
                    from: email.from_email,
                    to: email.to_email,
                    timestamp: email.ts ? toDate(email.ts).toISOString() : undefined,
                };
                
                const deal = getDeal(email.deal_id);
                const contact = contacts?.find(c => c.email_primary === email.from_email || c.email_primary === email.to_email);
                const company = getCompanyName(email.company_id || deal?.company_id || contact?.company_id);

                const result = await orchestrateInteraction({
                    interaction,
                    related_entities: { deal, contact, company },
                });
                
                if (result.actions.length > 0 && db) {
                    const batch = writeBatch(db);
                    const actionDocs: {ref: any, data: any}[] = [];

                    result.actions.forEach((action: Action) => {
                        const actionRef = doc(collection(db, 'users', user.uid, 'emails', email.id, 'actions'));
                        const actionData = {
                            id: actionRef.id,
                            type: action.type,
                            description: action.reason,
                            details: action.data || action.changes,
                            status: 'pending'
                        };
                        batch.set(actionRef, actionData);
                        actionDocs.push({ ref: actionRef, data: actionData });
                    });
                    
                    await batch.commit();

                    // Optimistically update the UI with the new actions
                     if (setEmails) {
                        setEmails(prevEmails => {
                            if (!prevEmails) return null;
                            return prevEmails.map(e => {
                                if (e.id === email.id) {
                                    const newActions = actionDocs.map(ad => ad.data as AIAction);
                                    return { ...e, actions: [...(e.actions || []), ...newActions] };
                                }
                                return e;
                            });
                        });
                    }

                }

            } catch (error: any) {
                // This catch block is for errors from the `orchestrateInteraction` flow itself.
                console.error(`Failed to process AI actions for email ${email.id}`, error);
            }
        }
        setProcessingActionsId(null);
        toast({ title: 'AI Actions Generation Complete!', description: 'Suggestions are being saved.'});
    };


    const handleSeedEmails = async () => {
        if (!db || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Firestore or user not available.' });
            return;
        }
        setIsSeeding(true);
        toast({ title: 'Seeding Emails...', description: 'Please wait while we populate your email history.' });

        try {
            const batch = writeBatch(db);

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
                     // This is a simple regex to handle commas within quoted fields
                    const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
                    const obj: Record<string, string> = {};
                    headers.forEach((header, index) => {
                        let value = values[index] || '';
                        if (value.startsWith('"') && value.endsWith('"')) {
                            value = value.substring(1, value.length - 1);
                        }
                        obj[header] = value;
                    });
                    return obj;
                }).filter((obj): obj is Record<string, string> => obj !== null);
            };

            const emailsData = parseCsv(emailsCsv);
            emailsData.forEach(emailObj => {
                const emailRef = doc(collection(db, 'users', user.uid, 'emails'));
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
            setIsSeeded(true);
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

    const allLabels = useMemo(() => {
        if (!emails) return [];
        const labelSet = new Set<string>();
        emails.forEach(email => {
            if (email.labels) {
                email.labels.split(';').forEach(label => labelSet.add(label.trim()));
            }
        });
        return Array.from(labelSet);
    }, [emails]);

    const filteredEmails = useMemo(() => {
        if (!emails) return [];
        return emails.filter(email => {
            const emailDate = toDate(email.ts);
            
            const isDateMatch = dateRange?.from ? isWithinInterval(emailDate, { start: dateRange.from, end: dateRange.to || dateRange.from }) : true;
            const isCompanyMatch = selectedCompany === 'all' || email.company_id === selectedCompany;
            
            const emailLabels = email.labels ? email.labels.split(';').map(l => l.trim()) : [];
            const isLabelMatch = selectedLabels.length === 0 || selectedLabels.every(sl => emailLabels.includes(sl));
            
            const isDirectionMatch = selectedDirections.length === 0 || selectedDirections.includes(email.direction);
            
            return isDateMatch && isCompanyMatch && isLabelMatch && isDirectionMatch;
        });
    }, [emails, dateRange, selectedCompany, selectedLabels, selectedDirections]);


    const renderLabels = (labels: string) => {
        if (!labels) return null;
        return labels.split(';').map(label => (
            <Badge key={label} variant="outline" className="mr-1 mb-1">{label}</Badge>
        ));
    };

    const clearFilters = () => {
        setDateRange(undefined);
        setSelectedCompany('all');
        setSelectedLabels([]);
        setSelectedDirections([]);
    }

    const filtersAreActive = dateRange || selectedCompany !== 'all' || selectedLabels.length > 0 || selectedDirections.length > 0;


    const handleSummarizeOne = async (emailId: string, text: string) => {
        if (!text) {
            toast({ variant: 'destructive', title: 'No Content', description: 'Email body is empty, cannot summarize.' });
            return;
        }
        if (!db || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Firestore or user not available.' });
            return;
        }

        setSummarizingId(emailId);
        try {
            const result = await summarizeText({ text });
            
            const emailRef = doc(db, 'users', user.uid, 'emails', emailId);
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
    
    const handleGenerateReply = (email: Email) => {
        setSelectedEmailForReply(email);
        setIsReplyDialogOpen(true);
    };

    const handleAnalyzeEmail = (email: Email) => {
        setSelectedEmailForAnalysis(email);
        setIsAnalyzeDialogOpen(true);
    };

    const handleScheduleMeeting = (email: Email) => {
        // Simple regex to find dates. In a real app, use a proper library.
        const dateRegex = /(\d{1,2}(st|nd|rd|th)?\s(of\s)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-zA-Z]*)|(tomorrow)|(next\s(week|monday|tuesday|wednesday|thursday|friday))/i;
        const match = email.body_excerpt.match(dateRegex);
        let suggestedDate = addDays(new Date(), 3);
        if (match && match[0]) {
            try {
                // This is a very basic parsing attempt.
                let parsedDate = new Date(match[0]);
                if (!isNaN(parsedDate.getTime())) {
                    suggestedDate = parsedDate;
                }
            } catch(e) { /* ignore parsing errors */ }
        }

        setMeetingDate(suggestedDate);
        setSelectedEmailForMeeting(email);
        setIsMeetingDialogOpen(true);
    };

    const confirmMeeting = async (status: ActionStatus) => {
        if (!user || !selectedEmailForMeeting || !meetingDate) return;
        
        setIsMeetingDialogOpen(false);
        setActionState(selectedEmailForMeeting.id, 'meeting', status);

        if (status === 'rejected') {
            toast({ title: 'Action Rejected', variant: 'default' });
            return;
        }

        const [hours, minutes] = meetingTime.split(':').map(Number);
        const finalMeetingDate = new Date(meetingDate);
        finalMeetingDate.setHours(hours, minutes);

        const batch = writeBatch(db);
        
        // 1. Log the meeting creation
        const meetingLogRef = doc(collection(db, 'audit_logs'));
        const meetingData = {
            title: `Meeting about: ${selectedEmailForMeeting.subject}`,
            proposed_time: finalMeetingDate.toISOString(),
            participants: [selectedEmailForMeeting.from_email, selectedEmailForMeeting.to_email],
            deal_id: selectedEmailForMeeting.deal_id
        };
        batch.set(meetingLogRef, {
            ts: new Date().toISOString(),
            actor_type: 'user',
            actor_id: user.uid,
            action: 'create_meeting',
            entity_type: 'meetings',
            entity_id: `meeting_${Date.now()}`,
            table: 'meetings',
            source: 'ui-suggestion',
            after_snapshot: meetingData,
        });

        // 2. Log the email sending simulation
        const emailLogRef = doc(collection(db, 'audit_logs'));
        const emailLogData = {
            to: selectedEmailForMeeting.from_email,
            from: selectedEmailForMeeting.to_email,
            subject: `Meeting Confirmed: ${selectedEmailForMeeting.subject}`,
            body: `Hi, \n\nThis is to confirm our meeting on ${format(finalMeetingDate, 'PPp')}. \n\nMeeting link: https://meet.google.com/lookup/${Math.random().toString(36).substring(2, 10)} \n\nBest,`,
            deal_id: selectedEmailForMeeting.deal_id
        };
        batch.set(emailLogRef, {
            ts: new Date().toISOString(),
            actor_type: 'system_ai',
            actor_id: 'system',
            action: 'send_email',
            entity_type: 'emails',
            entity_id: `email_log_${Date.now()}`,
            table: 'emails',
            source: 'ui-suggestion',
            after_snapshot: emailLogData
        });


        try {
            await batch.commit();
            toast({ title: 'Meeting Scheduled!', description: `A meeting for ${format(finalMeetingDate, 'PPp')} has been logged.` });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not log the meeting.' });
            console.error(error);
        }
    };
    
    const checkKeywords = (text: string, keywords: string[]) => {
        return keywords.some(keyword => text.toLowerCase().includes(keyword));
    };

    const handleApproveAllReplies = async () => {
        if (!user || !db || filteredEmails.length === 0) return;
        setIsApprovingReplies(true);
        toast({ title: "Approving all replies..." });

        const batch = writeBatch(db);
        for (const email of filteredEmails) {
            setActionState(email.id, 'reply', 'approved');
            const isReplying = email.direction === 'inbound';
            const subjectPrefix = email.subject.toLowerCase().startsWith('re:') ? '' : 'Re: ';
            const draftData = {
                source_type: 'email_reply', related_id: email.id,
                to: isReplying ? email.from_email : email.to_email,
                from: user.email, subject: isReplying ? `${subjectPrefix}${email.subject}` : `Following up on: ${email.subject}`,
                scheduled_at: (isReplying ? addDays(new Date(), 1) : addDays(new Date(), 5)).toISOString(),
                body: `Auto-generated reply for: ${email.subject}`,
                status: 'draft', createdAt: new Date().toISOString(), userId: user.uid,
            };

            const logRef = doc(collection(db, 'audit_logs'));
            batch.set(logRef, { ts: new Date().toISOString(), actor_type: 'user', actor_id: user.uid, action: 'send_email', entity_type: 'emails', entity_id: `simulated_${email.id}`, table: 'emails', source: 'ui-bulk-approval', after_snapshot: draftData });
        }

        try {
            await batch.commit();
            toast({ title: "All replies approved!", description: `${filteredEmails.length} email actions have been logged.` });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not approve all replies." });
        } finally {
            setIsApprovingReplies(false);
        }
    };

    const handleUpgradeHighConfidenceDeals = async () => {
        if (!user || !db || filteredEmails.length === 0) return;
        setIsUpgradingDeals(true);
        toast({ title: "Upgrading high-confidence deals..." });

        const batch = writeBatch(db);
        let updatedCount = 0;

        for (const email of filteredEmails) {
            const deal = getDeal(email.deal_id);
            if (deal) {
                const analysisResult = await analyzeEmailContent({ emailBody: email.body_excerpt, emailSubject: email.subject, currentDeal: deal });
                if (analysisResult.stageSuggestion && analysisResult.stageSuggestion.probability > 0.75) {
                    updatedCount++;
                    setActionState(email.id, 'analyze', 'approved');
                    const dealRef = doc(db, 'users', user.uid, 'deals', deal.id);
                    const changes = { stage: analysisResult.stageSuggestion.newStage };
                    batch.update(dealRef, changes);

                    const logRef = doc(collection(db, 'audit_logs'));
                    batch.set(logRef, { ts: new Date().toISOString(), actor_type: 'system_ai', actor_id: user.uid, action: 'update', entity_type: 'deals', entity_id: deal.id, table: 'deals', source: 'ui-bulk-approval', before_snapshot: { stage: deal.stage }, after_snapshot: changes });
                }
            }
        }
        
        try {
            await batch.commit();
            toast({ title: "Deals updated!", description: `${updatedCount} deals were upgraded based on high-confidence suggestions.` });
        } catch (error) {
             toast({ variant: "destructive", title: "Error", description: "Could not upgrade deals." });
        } finally {
            setIsUpgradingDeals(false);
        }
    };

    const handleApproveAllMeetings = async () => {
        if (!user || !db) return;
        
        const emailsForMeeting = filteredEmails.filter(email => email.direction === 'inbound' && checkKeywords(email.body_excerpt, ['meeting', 'talk', 'chat', 'schedule']));
        if(emailsForMeeting.length === 0) {
            toast({title: "No meeting suggestions found."});
            return;
        }

        setIsApprovingMeetings(true);
        toast({ title: "Approving all meetings..." });

        const batch = writeBatch(db);
        emailsForMeeting.forEach(email => {
            setActionState(email.id, 'meeting', 'approved');
            const meetingDate = addDays(new Date(), 3);
            const meetingLogRef = doc(collection(db, 'audit_logs'));
            const meetingData = { title: `Meeting re: ${email.subject}`, proposed_time: meetingDate.toISOString(), participants: [email.from_email, email.to_email], deal_id: email.deal_id };
            batch.set(meetingLogRef, { ts: new Date().toISOString(), actor_type: 'user', actor_id: user.uid, action: 'create_meeting', entity_type: 'meetings', entity_id: `meeting_${email.id}`, table: 'meetings', source: 'ui-bulk-approval', after_snapshot: meetingData });
        });

        try {
            await batch.commit();
            toast({ title: "All meetings approved!", description: `${emailsForMeeting.length} meetings have been logged.` });
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "Could not approve all meetings." });
        } finally {
            setIsApprovingMeetings(false);
        }
    };


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
                 <Button onClick={handleGenerateAiActions} disabled={!!processingActionsId}>
                    {processingActionsId ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Bot className="mr-2 h-4 w-4" />}
                    Generate AI Actions
                </Button>
                <Button onClick={handleSeedEmails} disabled={isSeeding || isSeeded}>
                    {isSeeding ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : isSeeded ? <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> : <Database className="mr-2 h-4 w-4" />}
                    Seed Database
                </Button>
            </div>
        </div>
        
        <div className="my-4 flex flex-wrap gap-2 items-center">
            <Button onClick={handleApproveAllReplies} disabled={isApprovingReplies}>
                {isApprovingReplies ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <MailPlus className="mr-2 h-4 w-4" />}
                Approve All Replies
            </Button>
            <Button onClick={handleUpgradeHighConfidenceDeals} disabled={isUpgradingDeals}>
                {isUpgradingDeals ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
                Upgrade High-Confidence Deals
            </Button>
            <Button onClick={handleApproveAllMeetings} disabled={isApprovingMeetings}>
                {isApprovingMeetings ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CalendarPlus className="mr-2 h-4 w-4" />}
                Approve All Meetings
            </Button>
             {filtersAreActive && (
                <Button variant="ghost" onClick={clearFilters} className="text-muted-foreground">
                    <FilterX className="mr-2 h-4 w-4" />
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
                        <TableHead className="w-[180px]">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" className="px-2 -ml-2 h-8">
                                        Timestamp
                                        <Filter className={cn("h-3 w-3 ml-2", dateRange ? 'text-primary' : 'text-muted-foreground/50')} />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar initialFocus mode="range" defaultMonth={dateRange?.from} selected={dateRange} onSelect={setDateRange} numberOfMonths={2} />
                                </PopoverContent>
                            </Popover>
                        </TableHead>
                        <TableHead className="w-[20%]">Subject</TableHead>
                         <TableHead>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="px-2 -ml-2 h-8">
                                        Direction
                                        <Filter className={cn("h-3 w-3 ml-2", selectedDirections.length > 0 ? 'text-primary' : 'text-muted-foreground/50')} />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    <DropdownMenuLabel>Filter by Direction</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuCheckboxItem checked={selectedDirections.includes('inbound')} onCheckedChange={(checked) => setSelectedDirections(prev => checked ? [...prev, 'inbound'] : prev.filter(d => d !== 'inbound'))}>Inbound</DropdownMenuCheckboxItem>
                                    <DropdownMenuCheckboxItem checked={selectedDirections.includes('outbound')} onCheckedChange={(checked) => setSelectedDirections(prev => checked ? [...prev, 'outbound'] : prev.filter(d => d !== 'outbound'))}>Outbound</DropdownMenuCheckboxItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                         </TableHead>
                        <TableHead>
                            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                                <SelectTrigger className="border-none bg-transparent hover:bg-muted focus:ring-0 focus:ring-offset-0 px-2 -ml-2 h-8 w-auto">
                                    <SelectValue placeholder="Company" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Companies</SelectItem>
                                    {companies?.map(company => ( <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem> ))}
                                </SelectContent>
                            </Select>
                        </TableHead>
                        <TableHead>Deal</TableHead>
                        <TableHead className="w-[35%]">AI Summary</TableHead>
                        <TableHead>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="px-2 -ml-2 h-8">
                                        Labels
                                        <Filter className={cn("h-3 w-3 ml-2", selectedLabels.length > 0 ? 'text-primary' : 'text-muted-foreground/50')} />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Filter by Label</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {allLabels.map(label => (
                                        <DropdownMenuCheckboxItem key={label} checked={selectedLabels.includes(label)} onCheckedChange={(checked) => setSelectedLabels(prev => checked ? [...prev, label] : prev.filter(l => l !== label))}>{label}</DropdownMenuCheckboxItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </TableHead>
                        <TableHead>Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(emailsLoading || crmDataLoading) && <TableRow><TableCell colSpan={8} className="text-center">Loading emails...</TableCell></TableRow>}
                    {!emailsLoading && filteredEmails.length === 0 && <TableRow><TableCell colSpan={8} className="text-center">No emails found.</TableCell></TableRow>}
                    {filteredEmails.map((email) => {
                        const company = getCompanyName(email.company_id);
                        const deal = getDeal(email.deal_id);
                        
                        const isProcessingRow = processingActionsId === email.id;

                        const getIconClass = (actionType: ActionType) => {
                            const userDecision = email.actionStates?.[actionType];
                            if (userDecision === 'approved') return 'text-green-500';
                            if (userDecision === 'rejected') return 'text-red-500';
                            
                            const hasPendingAction = email.actions?.some(a => 
                                (actionTypeMapping[a.type] === actionType || a.type === actionType) && a.status === 'pending'
                            );
                            if (hasPendingAction) return 'text-yellow-500';
                            
                            return 'text-muted-foreground';
                        };

                        return (
                        <TableRow key={email.id} className={cn(isProcessingRow && "opacity-50")}>
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
                                                From: {email.from_email} To: {email.to_email}
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto">
                                            <p>{email.body_excerpt}</p>
                                        </div>
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
                                                    <Sparkles className="h-4 w-4" />
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
                                            <Button variant="ghost" size="icon" onClick={() => handleGenerateReply(email)} disabled={isProcessingRow}>
                                                <MailPlus className={cn("h-4 w-4", getIconClass('reply'))} />
                                                <span className="sr-only">Generate Reply</span>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Generate Reply</p></TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => handleAnalyzeEmail(email)} disabled={isProcessingRow}>
                                                <TrendingUp className={cn("h-4 w-4", getIconClass('analyze'))} />
                                                <span className="sr-only">Analyze Stage</span>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Analyze Stage</p></TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => handleScheduleMeeting(email)} disabled={isProcessingRow}>
                                                <CalendarPlus className={cn("h-4 w-4", getIconClass('meeting'))} />
                                                <span className="sr-only">Schedule Meeting</span>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Schedule Meeting</p></TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" onClick={() => { /* Placeholder for task dialog */ toast({title: 'Not Implemented'})}} disabled={isProcessingRow}>
                                                <FileText className={cn("h-4 w-4", getIconClass('task'))} />
                                                <span className="sr-only">Create Task</span>
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent><p>Create Task</p></TooltipContent>
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
       {selectedEmailForOrchestration && user && (
        <OrchestratorSuggestionDialog
            open={isOrchestratorOpen}
            onOpenChange={setIsOrchestratorOpen}
            email={selectedEmailForOrchestration}
            processFunction={async () => {
                const interaction: Interaction = {
                    source: 'email',
                    direction: selectedEmailForOrchestration.direction,
                    subject: selectedEmailForOrchestration.subject,
                    body: selectedEmailForOrchestration.body_excerpt,
                    from: selectedEmailForOrchestration.from_email,
                    to: selectedEmailForOrchestration.to_email,
                    timestamp: toDate(selectedEmailForOrchestration.ts).toISOString(),
                };
                const deal = getDeal(selectedEmailForOrchestration.deal_id);
                return orchestrateInteraction({ interaction, related_entities: { deal }});
            }}
        />
       )}
      {selectedEmailForAnalysis && user && deals && (
        <AnalyzeEmailDialog
            open={isAnalyzeDialogOpen}
            onOpenChange={setIsAnalyzeDialogOpen}
            onStatusChange={(status) => setActionState(selectedEmailForAnalysis.id, 'analyze', status)}
            email={selectedEmailForAnalysis}
            deal={getDeal(selectedEmailForAnalysis.deal_id)}
            user={user}
        />
      )}
       {selectedEmailForReply && user && (
        <EmailReplyDialog
            open={isReplyDialogOpen}
            onOpenChange={setIsReplyDialogOpen}
            onStatusChange={(status) => setActionState(selectedEmailForReply.id, 'reply', status)}
            email={selectedEmailForReply}
            user={user}
        />
      )}
      {selectedEmailForMeeting && (
        <Dialog open={isMeetingDialogOpen} onOpenChange={setIsMeetingDialogOpen}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Schedule Meeting</DialogTitle>
                    <DialogDescription>
                        Confirm date and time to schedule a meeting. An event and a confirmation email will be logged.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="p-4 border rounded-lg bg-muted/50 space-y-2 max-h-48 overflow-y-auto">
                        <h4 className="font-semibold text-sm">Original Email</h4>
                        <p className="text-sm font-medium">{selectedEmailForMeeting.subject}</p>
                        <p className="text-xs text-muted-foreground">From: {selectedEmailForMeeting.from_email}</p>
                        <div className="prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto">
                            <p>{selectedEmailForMeeting.body_excerpt}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label>Meeting Date</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !meetingDate && "text-muted-foreground")}>
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {meetingDate ? format(meetingDate, 'PPP') : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar mode="single" selected={meetingDate} onSelect={setMeetingDate} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="meeting-time">Meeting Time</Label>
                            <Input id="meeting-time" type="time" value={meetingTime} onChange={(e) => setMeetingTime(e.target.value)} />
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="destructive" onClick={() => confirmMeeting('rejected')}>Reject</Button>
                    <Button onClick={() => confirmMeeting('approved')} className="bg-green-600 hover:bg-green-700 text-white">Approve & Log Meeting</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </main>
    </TooltipProvider>
  );
}

    