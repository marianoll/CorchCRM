'use client';

import { useState, useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useUser } from '@/firebase/auth/use-user';
import { db } from '@/firebase/client';
import { collection, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, isPast, formatDistanceToNow } from 'date-fns';
import { ClipboardCheck, PlusCircle } from 'lucide-react';
import { CreateTaskForm } from '@/components/create-task-form';

type Task = {
    id: string;
    description: string;
    done: boolean;
    createdAt: string;
    dueDate: string;
    contactId?: string;
    dealId?: string;
};

const DateDisplay = ({ dateString }: { dateString: string }) => {
    const date = new Date(dateString);
    const isOverdue = isPast(date) && !new Date(dateString).toDateString().includes(new Date().toDateString());

    const formattedDate = format(date, "MMM d, yyyy");
    const distance = formatDistanceToNow(date, { addSuffix: true });

    return (
        <div className="flex flex-col">
            <span className={isOverdue ? "text-destructive font-medium" : ""}>{formattedDate}</span>
            <span className="text-xs text-muted-foreground">{isOverdue ? `${distance} (overdue)` : distance}</span>
        </div>
    );
};


export default function TasksPage() {
    const { user } = useUser();
    const [isCreateTaskOpen, setCreateTaskOpen] = useState(false);
    
    // Queries for tasks
    const upcomingTasksQuery = useMemo(() => user 
        ? query(collection(db, 'users', user.uid, 'tasks'), where('done', '==', false), orderBy('dueDate', 'asc')) 
        : null
    , [user]);

    const completedTasksQuery = useMemo(() => user 
        ? query(collection(db, 'users', user.uid, 'tasks'), where('done', '==', true), orderBy('dueDate', 'desc')) 
        : null
    , [user]);

    const { data: upcomingTasks, loading: upcomingLoading } = useCollection<Task>(upcomingTasksQuery);
    const { data: completedTasks, loading: completedLoading } = useCollection<Task>(completedTasksQuery);
    
    const handleToggleDone = async (task: Task) => {
        if (!user || !db) return;
        const taskRef = doc(db, 'users', user.uid, 'tasks', task.id);
        await updateDoc(taskRef, { done: !task.done });
    };

    const renderTaskRows = (tasks: Task[] | null, loading: boolean) => {
        if (loading) {
            return <TableRow><TableCell colSpan={4} className="text-center">Loading tasks...</TableCell></TableRow>;
        }
        if (!tasks || tasks.length === 0) {
            return <TableRow><TableCell colSpan={4} className="text-center">No tasks found.</TableCell></TableRow>;
        }
        return tasks.map(task => (
             <TableRow key={task.id} className={task.done ? 'text-muted-foreground line-through' : ''}>
                <TableCell className="w-[50px]">
                    <Checkbox
                        checked={task.done}
                        onCheckedChange={() => handleToggleDone(task)}
                        aria-label={`Mark task "${task.description}" as ${task.done ? 'not done' : 'done'}`}
                    />
                </TableCell>
                <TableCell className="font-medium">{task.description}</TableCell>
                <TableCell><DateDisplay dateString={task.dueDate} /></TableCell>
                <TableCell>{format(new Date(task.createdAt), "MMM d, yyyy")}</TableCell>
            </TableRow>
        ));
    };


  return (
    <>
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
                    <ClipboardCheck className="h-7 w-7" />
                    Tasks
                </h1>
                <p className="text-muted-foreground">Manage all your upcoming and completed tasks.</p>
            </div>
            <Button onClick={() => setCreateTaskOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" /> New Task
            </Button>
        </div>
        
        <Tabs defaultValue="upcoming" className="w-full">
            <TabsList>
                <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming">
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Created</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                           {renderTaskRows(upcomingTasks, upcomingLoading)}
                        </TableBody>
                    </Table>
                </div>
            </TabsContent>
            <TabsContent value="completed">
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Created</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                            {renderTaskRows(completedTasks, completedLoading)}
                        </TableBody>
                    </Table>
                </div>
            </TabsContent>
        </Tabs>
      </div>
    </main>
    <CreateTaskForm open={isCreateTaskOpen} onOpenChange={setCreateTaskOpen} />
    </>
  );
}
