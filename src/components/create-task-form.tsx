'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, LoaderCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useUser } from '@/firebase/auth/hooks';
import { db } from '@/firebase/client';
import { collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const formSchema = z.object({
  description: z.string().min(2, 'Description must be at least 2 characters.'),
  dueDate: z.date({
    required_error: 'A due date is required.',
  }),
});

type Task = {
    id: string;
    description: string;
    done: boolean;
    createdAt: string;
    dueDate: string;
};

type CreateTaskFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
};

export function CreateTaskForm({ open, onOpenChange, task }: CreateTaskFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
      dueDate: new Date(),
    },
  });

  const isEditing = !!task;

  useEffect(() => {
    if (open) {
        if (isEditing && task) {
            form.reset({
                 description: task.description,
                 dueDate: new Date(task.dueDate),
            });
        } else {
            form.reset({
                description: '',
                dueDate: new Date(),
            });
        }
    }
  }, [task, isEditing, form, open]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    if (!db || !user) {
       toast({
         variant: 'destructive',
         title: 'Authentication Error',
         description: 'User or database is not available.',
       });
       setIsSubmitting(false);
       return;
    }
    
    const taskRef = isEditing && task ? doc(db, 'users', user.uid, 'tasks', task.id) : doc(collection(db, 'users', user.uid, 'tasks'));
    
    const taskData = {
        ...values,
        id: taskRef.id,
        done: isEditing ? task.done : false,
        createdAt: isEditing ? task.createdAt : new Date().toISOString(),
    };

    try {
        await setDoc(taskRef, taskData, { merge: true });

        toast({
            title: isEditing ? 'Task Updated' : 'Task Created',
            description: `The task "${values.description}" has been saved.`,
        });

        form.reset();
        onOpenChange(false);
    } catch(error) {
        console.error("Error saving task:", error);
        toast({
            variant: 'destructive',
            title: 'Submission Error',
            description: 'An unexpected error occurred while saving the task.',
        });
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Task' : 'Create New Task'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details for your task.' : 'Fill in the details for your new task.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="Follow up with..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Due Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Save Task'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
