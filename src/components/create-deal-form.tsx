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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { collection, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const formSchema = z.object({
  title: z.string().min(2, 'Deal title must be at least 2 characters.'),
  company_id: z.string().optional(),
  primary_contact_id: z.string().min(1, 'Please select a contact.'),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  currency: z.string().optional(),
  stage: z.enum(['prospect', 'discovery', 'proposal', 'negotiation', 'won', 'lost']),
  probability: z.coerce.number().min(0).max(100).optional(),
  close_date: z.date({
    required_error: 'A close date is required.',
  }),
});

type Contact = {
  id: string;
  full_name: string;
};

type Company = {
    id: string;
    name: string;
};

type Deal = {
    id: string;
    company_id?: string;
    primary_contact_id: string;
    title: string;
    amount: number;
    currency?: string;
    stage: 'prospect' | 'discovery' | 'proposal' | 'negotiation' | 'won' | 'lost';
    probability?: number;
    close_date: Date | Timestamp | string;
    owner_email?: string;
    last_interaction_at?: Date | Timestamp | string;
};

type CreateDealFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  companies: Company[];
  deal?: Deal | null;
};

export function CreateDealForm({ open, onOpenChange, contacts, companies, deal }: CreateDealFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      amount: 0,
      currency: 'USD',
      stage: 'prospect',
      probability: undefined,
      close_date: new Date(),
    },
  });

  const isEditing = !!deal;

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

  useEffect(() => {
    if (open) {
        if (isEditing && deal) {
            form.reset({
                 ...deal,
                 probability: deal.probability || undefined,
                 currency: deal.currency || 'USD',
                 close_date: toDate(deal.close_date)
            });
        } else {
            form.reset({
                title: '',
                amount: 0,
                stage: 'prospect',
                probability: undefined,
                currency: 'USD',
                close_date: new Date(),
                primary_contact_id: undefined,
                company_id: undefined,
            });
        }
    }
  }, [deal, isEditing, form, open]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);

    if (!db || !user) {
        toast({
            variant: 'destructive',
            title: 'Authentication Error',
            description: 'User or database is not available. Please try again.',
        });
       setIsSubmitting(false);
       return;
    }
    
    const batch = writeBatch(db);

    try {
        if (isEditing && deal) {
            const dealRef = doc(db, 'users', user.uid, 'deals', deal.id);
            batch.update(dealRef, values);

            const logRef = doc(collection(db, 'audit_logs'));
            batch.set(logRef, {
                ts: new Date().toISOString(),
                actor_type: 'user',
                actor_id: user!.uid,
                action: 'update',
                entity_type: 'deal',
                entity_id: deal.id,
                table: 'deals',
                source: 'ui',
                before_snapshot: deal,
                after_snapshot: values,
            });
        } else {
            const dealRef = doc(collection(db, 'users', user.uid, 'deals'));
            batch.set(dealRef, values);

            const logRef = doc(collection(db, 'audit_logs'));
            batch.set(logRef, {
                ts: new Date().toISOString(),
                actor_type: 'user',
                actor_id: user!.uid,
                action: 'create',
                entity_type: 'deal',
                entity_id: dealRef.id,
                table: 'deals',
                source: 'ui',
                after_snapshot: values,
            });
        }
        
        await batch.commit();

        toast({
            title: isEditing ? 'Deal Updated' : 'Deal Created',
            description: `The deal "${values.title}" has been successfully ${isEditing ? 'updated' : 'created'}.`,
        });

        form.reset();
        onOpenChange(false);
    } catch(error) {
        if (error instanceof FirestorePermissionError) {
             errorEmitter.emit('permission-error', error);
        } else {
             toast({
                variant: 'destructive',
                title: 'Submission Error',
                description: 'An unexpected error occurred while saving the deal.',
            });
        }
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Deal' : 'Create New Deal'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details below.' : 'Fill in the details below to add a new deal.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Website Redesign Project" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
                control={form.control}
                name="company_id"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Company</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a company" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {companies.map(company => (
                                    <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="primary_contact_id"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Primary Contact</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a contact" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {contacts.map(contact => (
                                    <SelectItem key={contact.id} value={contact.id}>{contact.full_name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
             <FormField
              control={form.control}
              name="close_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Close Date</FormLabel>
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
             <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                        <Input type="number" placeholder="5000" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <FormControl>
                        <Input placeholder="USD" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            <FormField
              control={form.control}
              name="stage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Stage</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a stage" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="prospect">Prospect</SelectItem>
                      <SelectItem value="discovery">Discovery</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="negotiation">Negotiation</SelectItem>
                      <SelectItem value="won">Won</SelectItem>
                      <SelectItem value="lost">Lost</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="probability"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Probability (%)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" max="100" placeholder="e.g., 90" {...field} />
                  </FormControl>
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
                {isEditing ? 'Save Changes' : 'Save Deal'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
