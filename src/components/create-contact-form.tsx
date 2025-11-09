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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { LoaderCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useUser } from '@/firebase/auth/hooks';
import { db } from '@/firebase/client';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const formSchema = z.object({
  first_name: z.string().min(1, 'First name is required.'),
  last_name: z.string().min(1, 'Last name is required.'),
  email_primary: z.string().email('Invalid email address.'),
  phone: z.string().optional(),
  company_id: z.string().optional(),
  title: z.string().optional(),
  seniority: z.string().optional(),
});

type Contact = {
    id: string;
    company_id?: string;
    first_name: string;
    last_name: string;
    full_name: string;
    email_primary: string;
    email_alt?: string;
    phone?: string;
    title?: string;
    seniority?: string;
    linkedin_url?: string;
    owner_email?: string;
};

type Company = {
    id: string;
    name: string;
}

type CreateContactFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  companies: Company[];
};

export function CreateContactForm({ open, onOpenChange, contact, companies }: CreateContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email_primary: '',
      phone: '',
      company_id: '',
      title: '',
      seniority: ''
    },
  });

  const isEditing = !!contact;

  useEffect(() => {
    if (open) {
        if (isEditing && contact) {
            form.reset({
                first_name: contact.first_name,
                last_name: contact.last_name,
                email_primary: contact.email_primary,
                phone: contact.phone || '',
                company_id: contact.company_id || '',
                title: contact.title || '',
                seniority: contact.seniority || '',
            });
        } else {
            form.reset({
              first_name: '',
              last_name: '',
              email_primary: '',
              phone: '',
              company_id: '',
              title: '',
              seniority: '',
            });
        }
    }
  }, [contact, isEditing, form, open]);

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
    const full_name = `${values.first_name} ${values.last_name}`;
    const contactData = { ...values, full_name };

    try {
        if (isEditing && contact) {
            const contactRef = doc(db, 'users', user.uid, 'contacts', contact.id);
            batch.update(contactRef, contactData);

            const logRef = doc(collection(db, 'audit_logs'));
            batch.set(logRef, {
                ts: new Date().toISOString(),
                actor_type: 'user',
                actor_id: user!.uid,
                action: 'update',
                entity_type: 'contact',
                entity_id: contact.id,
                table: 'contacts',
                source: 'ui',
                before_snapshot: contact,
                after_snapshot: contactData,
            });
        } else {
            const contactRef = doc(collection(db, 'users', user.uid, 'contacts'));
            batch.set(contactRef, contactData);

            const logRef = doc(collection(db, 'audit_logs'));
            batch.set(logRef, {
                ts: new Date().toISOString(),
                actor_type: 'user',
                actor_id: user!.uid,
                action: 'create',
                entity_type: 'contact',
                entity_id: contactRef.id,
                table: 'contacts',
                source: 'ui',
                after_snapshot: contactData,
            });
        }

        await batch.commit();
        
        toast({
            title: isEditing ? 'Contact Updated' : 'Contact Created',
            description: `${full_name} has been ${isEditing ? 'updated' : 'added to your contacts'}.`,
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
                description: 'An unexpected error occurred while saving the contact.',
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
          <DialogTitle>{isEditing ? 'Edit Contact' : 'Create New Contact'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details below.' : 'Fill in the details below to add a new contact.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
               <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="email_primary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="john.doe@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+1 234 567 890" {...field} />
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="CEO, Marketing Director..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="seniority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Seniority</FormLabel>
                  <FormControl>
                    <Input placeholder="Director, C-Level..." {...field} />
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
                {isEditing ? 'Save Changes' : 'Save Contact'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
