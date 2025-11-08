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
import { LoaderCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  email: z.string().email('Invalid email address.'),
  phone: z.string().optional(),
  company: z.string().optional(),
});

type Contact = {
    id: string;
    name: string;
    email: string;
    phone?: string;
    companyId?: string;
};

type CreateContactFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
};

export function CreateContactForm({ open, onOpenChange, contact }: CreateContactFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      company: '',
    },
  });

  const isEditing = !!contact;

  useEffect(() => {
    if (open) {
        if (isEditing && contact) {
            form.reset({
                name: contact.name,
                email: contact.email,
                phone: contact.phone || '',
                company: contact.companyId || '',
            });
        } else {
            form.reset({ name: '', email: '', phone: '', company: '' });
        }
    }
  }, [contact, isEditing, form, open]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Firestore or user is not available.',
        });
        return;
    }
    setIsSubmitting(true);
    
    const dataToSave = {
      name: values.name,
      email: values.email,
      phone: values.phone,
      companyId: values.company || ''
    };

    try {
        const batch = writeBatch(firestore);
        
        if (isEditing && contact) {
            const contactRef = doc(firestore, 'contacts', contact.id);
            batch.set(contactRef, dataToSave, { merge: true });

            const logRef = doc(collection(firestore, 'audit_logs'));
            batch.set(logRef, {
                ts: new Date().toISOString(),
                actor_type: 'user',
                actor_id: user.uid,
                action: 'update',
                entity_type: 'contact',
                entity_id: contact.id,
                table: 'contacts',
                source: 'ui',
                before_snapshot: contact,
                after_snapshot: dataToSave,
            });

            toast({
                title: 'Contact Updated',
                description: `${values.name} has been updated.`,
            });
        } else {
            const contactRef = doc(collection(firestore, 'contacts'));
            batch.set(contactRef, dataToSave);

            const logRef = doc(collection(firestore, 'audit_logs'));
            batch.set(logRef, {
                ts: new Date().toISOString(),
                actor_type: 'user',
                actor_id: user.uid,
                action: 'create',
                entity_type: 'contact',
                entity_id: contactRef.id,
                table: 'contacts',
                source: 'ui',
                after_snapshot: dataToSave,
            });

            toast({
              title: 'Contact Created',
              description: `${values.name} has been added to your contacts.`,
            });
        }

        await batch.commit().catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: isEditing ? `contacts/${contact?.id}` : 'contacts',
                operation: isEditing ? 'update' : 'create',
                requestResourceData: dataToSave,
            });
            errorEmitter.emit('permission-error', permissionError);
        });

        form.reset();
        onOpenChange(false);
    } catch(e) {
        // Errors handled by permission error emitter
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
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
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
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Inc." {...field} />
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
