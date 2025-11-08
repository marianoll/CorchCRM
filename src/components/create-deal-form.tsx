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
import { useFirestore, useUser } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const formSchema = z.object({
  name: z.string().min(2, 'Deal name must be at least 2 characters.'),
  companyId: z.string().optional(),
  contactId: z.string().min(1, 'Please select a contact.'),
  amount: z.coerce.number().positive('Amount must be a positive number.'),
  stage: z.enum(['lead', 'contacted', 'proposal', 'negotiation', 'won', 'lost']),
  creationDate: z.date({
    required_error: 'A creation date is required.',
  }),
});

type Contact = {
  id: string;
  name: string;
};

type Company = {
    id: string;
    name: string;
};

type Deal = {
    id: string;
    name: string;
    amount: number;
    stage: 'lead' | 'contacted' | 'proposal' | 'negotiation' | 'won' | 'lost';
    contactId: string;
    companyId?: string;
    creationDate?: { seconds: number; nanoseconds: number } | Date;
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
  const firestore = useFirestore();
  const { user } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      amount: 0,
      stage: 'lead',
      creationDate: new Date(),
    },
  });

  const isEditing = !!deal;

  useEffect(() => {
    if (open) {
        if (isEditing && deal) {
            let creationDate = new Date();
            if (deal.creationDate) {
                if (deal.creationDate instanceof Date) {
                    creationDate = deal.creationDate;
                } else if (deal.creationDate && typeof deal.creationDate.seconds === 'number') {
                    creationDate = new Date(deal.creationDate.seconds * 1000);
                }
            }
            form.reset({ ...deal, creationDate });
        } else {
            form.reset({
                name: '',
                amount: 0,
                stage: 'lead',
                creationDate: new Date(),
                contactId: undefined,
                companyId: undefined,
            });
        }
    }
  }, [deal, isEditing, form, open]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);

    if (!firestore || !user) {
        toast({
            variant: 'destructive',
            title: 'Connection Error',
            description: 'Could not connect to the database. Please try again.',
        });
        setIsSubmitting(false);
        return;
    }
    
    const batch = writeBatch(firestore);

    try {
        if (isEditing && deal) {
            const dealRef = doc(firestore, 'deals', deal.id);
            batch.set(dealRef, values, { merge: true });

            const logRef = doc(collection(firestore, 'audit_logs'));
            batch.set(logRef, {
                ts: new Date().toISOString(),
                actor_type: 'user',
                actor_id: user.uid,
                action: 'update',
                entity_type: 'deal',
                entity_id: deal.id,
                table: 'deals',
                source: 'ui',
                before_snapshot: deal,
                after_snapshot: values,
            });
        } else {
            const dealRef = doc(collection(firestore, 'deals'));
            batch.set(dealRef, values);

            const logRef = doc(collection(firestore, 'audit_logs'));
            batch.set(logRef, {
                ts: new Date().toISOString(),
                actor_type: 'user',
                actor_id: user.uid,
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
            description: `The deal "${values.name}" has been successfully ${isEditing ? 'updated' : 'created'}.`,
        });

        form.reset();
        onOpenChange(false);
    } catch(error) {
        if (!(error instanceof FirestorePermissionError)) {
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deal Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Website Redesign Project" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
                control={form.control}
                name="companyId"
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
                name="contactId"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Contact</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a contact" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {contacts.map(contact => (
                                    <SelectItem key={contact.id} value={contact.id}>{contact.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />
             <FormField
              control={form.control}
              name="creationDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Creation Date</FormLabel>
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
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
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
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="contacted">Contacted</SelectItem>
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
