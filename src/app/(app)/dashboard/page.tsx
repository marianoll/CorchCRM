'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useCollection } from '@/firebase/firestore/use-collection';
import { useUser } from '@/firebase/auth/use-user';
import { db } from '@/firebase/client';
import { collection, query, where, orderBy, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { LoaderCircle, ListChecks, Mail, Briefcase, Calendar, Database, EyeOff, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';


// --- Types ---
type Task = {
    id: string;
    description: string;
    done: boolean;
    createdAt: string | Timestamp;
    dueDate: string | Timestamp;
};

type AuditLog = {
    id: string;
    ts: string;
    action: string;
    entity_type: string;
    entity_id: string;
    after_snapshot?: any;
    before_snapshot?: any;
};

type Email = {
    id: string;
    ts: string | Timestamp;
    direction: 'inbound' | 'outbound';
    ai_summary?: string;
    subject: string;
};

const toDate = (date: string | Timestamp | Date): Date => {
    if (date instanceof Date) return date;
    if (date instanceof Timestamp) return date.toDate();
    if (typeof date === 'string') return new Date(date);
    return new Date();
};

// --- Task Card ---
const TasksCard = () => {    
    const { user } = useUser();
    const [hideCompleted, setHideCompleted] = useState(false);

    const tasksQuery = useMemo(() => user 
        ? query(collection(db, 'users', user.uid, 'tasks'), orderBy('dueDate', 'asc')) 
        : null
    , [user]);
    const { data: tasks, loading } = useCollection<Task>(tasksQuery);
    
    const handleToggleDone = async (task: Task) => {
        if (!user || !db) return;
        const taskRef = doc(db, 'users', user.uid, 'tasks', task.id);
        await updateDoc(taskRef, { done: !task.done });
    };

    const visibleTasks = useMemo(() => {
        if (!tasks) return [];
        return hideCompleted ? tasks.filter(t => !t.done) : tasks;
    }, [tasks, hideCompleted]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className='space-y-1.5'>
                    <CardTitle className="flex items-center gap-2"><ListChecks /> Tasks</CardTitle>
                    <CardDescription>Your upcoming and completed tasks.</CardDescription>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setHideCompleted(!hideCompleted)}>
                    {hideCompleted ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                </Button>
            </CardHeader>
            <CardContent>
                {loading ? <div className="flex justify-center items-center h-24"><LoaderCircle className="animate-spin" /></div> : (
                    <ScrollArea className="h-64 pr-4">
                        <div className="space-y-4">
                            {visibleTasks.length === 0 && <p className="text-sm text-muted-foreground text-center">No tasks found.</p>}
                            {visibleTasks.map((task) => (
                                <div key={task.id} className="flex items-start gap-3">
                                    <Checkbox 
                                        id={`task-${task.id}`} 
                                        checked={task.done} 
                                        onCheckedChange={() => handleToggleDone(task)}
                                        className="mt-1"
                                    />
                                    <div className="flex-1">
                                        <label htmlFor={`task-${task.id}`} className={`text-sm font-medium leading-none ${task.done ? 'line-through text-muted-foreground' : ''}`}>
                                        {task.description}
                                        </label>
                                        <p className="text-xs text-muted-foreground">
                                            Due {formatDistanceToNow(toDate(task.dueDate), { addSuffix: true })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
};

// --- Data (Audit) Card ---
const DataCard = () => {
    const { user } = useUser();
    const logsQuery = useMemo(() => user 
        ? query(
            collection(db, 'audit_logs'), 
            where('actor_id', '==', user.uid),
            where('action', 'in', ['update', 'create']),
            orderBy('ts', 'desc'),
            where('entity_type', 'in', ['company', 'contact', 'deal']),
            )
        : null
    , [user]);
    const { data: logs, loading } = useCollection<AuditLog>(logsQuery);

    const getEntityName = (log: AuditLog) => {
        const snapshot = log.after_snapshot || log.before_snapshot;
        if (!snapshot) return log.entity_id;
        return snapshot.name || snapshot.title || snapshot.full_name || log.entity_id;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Database /> Data Changes</CardTitle>
                <CardDescription>A log of recent data modifications.</CardDescription>
            </CardHeader>
            <CardContent>
                 {loading ? <div className="flex justify-center items-center h-24"><LoaderCircle className="animate-spin" /></div> : (
                     <ScrollArea className="h-64 pr-4">
                        <div className="space-y-4">
                             {logs?.length === 0 && <p className="text-sm text-muted-foreground text-center">No data changes recorded.</p>}
                            {logs?.map((log) => (
                                <div key={log.id} className="text-sm">
                                    <p><span className="font-semibold capitalize">{log.entity_type}</span> {getEntityName(log)} was {log.action}d.</p>
                                    <p className="text-xs text-muted-foreground">{formatDistanceToNow(toDate(log.ts), { addSuffix: true })}</p>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                 )}
            </CardContent>
        </Card>
    );
};

// --- Meetings Card ---
const MeetingsCard = () => {
    const { user } = useUser();
     const meetingsQuery = useMemo(() => user 
        ? query(
            collection(db, 'audit_logs'), 
            where('actor_id', '==', user.uid),
            where('action', '==', 'create_meeting'),
            orderBy('ts', 'desc'),
        )
        : null
    , [user]);
    const { data: meetings, loading } = useCollection<AuditLog>(meetingsQuery);
    
    const upcomingMeetings = useMemo(() => {
        if (!meetings) return [];
        return meetings
            .map(m => ({ ...m.after_snapshot, id: m.id, proposed_time: toDate(m.after_snapshot.proposed_time) }))
            .filter(m => !isPast(m.proposed_time));
    }, [meetings]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Calendar /> Upcoming Meetings</CardTitle>
                <CardDescription>Your next scheduled appointments.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? <div className="flex justify-center items-center h-24"><LoaderCircle className="animate-spin" /></div> : (
                     <ScrollArea className="h-64 pr-4">
                        <div className="space-y-4">
                            {upcomingMeetings.length === 0 && <p className="text-sm text-muted-foreground text-center">No upcoming meetings.</p>}
                            {upcomingMeetings.map((meeting) => (
                                <div key={meeting.id}>
                                    <p className="font-semibold text-sm">{meeting.title}</p>
                                    <p className="text-xs">{format(meeting.proposed_time, 'PPPP p')}</p>
                                    <p className="text-xs text-muted-foreground truncate">With: {meeting.participants.join(', ')}</p>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </CardContent>
        </Card>
    );
};


// --- Email Activity Card ---
const EmailActivityCard = () => {
     const { user } = useUser();
    const emailsQuery = useMemo(() => user 
        ? query(
            collection(db, 'users', user.uid, 'emails'),
            orderBy('ts', 'desc'),
        )
        : null
    , [user]);
    const { data: emails, loading } = useCollection<Email>(emailsQuery);

    return (
         <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Mail /> Email Activity</CardTitle>
                <CardDescription>Summary of recent email interactions.</CardDescription>
            </CardHeader>
            <CardContent>
                 {loading ? <div className="flex justify-center items-center h-24"><LoaderCircle className="animate-spin" /></div> : (
                     <ScrollArea className="h-64 pr-4">
                        <div className="space-y-4">
                             {emails?.length === 0 && <p className="text-sm text-muted-foreground text-center">No email activity found.</p>}
                            {emails?.map((email) => (
                                <div key={email.id} className="text-sm">
                                    <div className="flex justify-between items-center">
                                        <p className="font-semibold truncate pr-2">{email.subject}</p>
                                        <Badge variant={email.direction === 'inbound' ? 'default' : 'secondary'}>{email.direction}</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{email.ai_summary || 'No summary available'}</p>
                                    <p className="text-xs text-muted-foreground">{format(toDate(email.ts), 'PP p')}</p>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                 )}
            </CardContent>
        </Card>
    )
}


export default function DashboardPage() {
    return (
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold tracking-tight mb-6 font-headline">
                    Dashboard
                </h1>
                <div className="grid gap-6 md:grid-cols-2">
                    <TasksCard />
                    <DataCard />
                    <MeetingsCard />
                    <EmailActivityCard />
                </div>
            </div>
        </main>
    );
}