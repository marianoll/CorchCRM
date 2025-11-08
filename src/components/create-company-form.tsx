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
  name: z.string().min(2, 'Company name must be at least 2 characters.'),
  website: z.string().url('Invalid URL.').optional().or(z.literal('')),
});

type Company = {
    id: string;
    name: string;
    website?: string;
};

type CreateCompanyFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company?: Company | null;
};

export function CreateCompanyForm({ open, onOpenChange, company }: CreateCompanyFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      website: '',
    },
  });

  const isEditing = !!company;

  useEffect(() => {
    if (isEditing && company) {
        form.reset(company);
    } else {
        form.reset({ name: '', website: '' });
    }
  }, [company, isEditing, form, open]);


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    
    if (!firestore || !user) {
        toast({
            variant: "destructive",
            title: "Connection Error",
            description: "Could not connect to the database. Please try again.",
        });
        setIsSubmitting(false);
        return;
    }
    
    const batch = writeBatch(firestore);

    try {
        if (isEditing && company) {
            const companyRef = doc(firestore, 'companies', company.id);
            batch.set(companyRef, values, { merge: true });

            const logRef = doc(collection(firestore, 'audit_logs'));
            batch.set(logRef, {
                ts: new Date().toISOString(),
                actor_type: 'user',
                actor_id: user?.uid || null,
                action: 'update',
                entity_type: 'company',
                entity_id: company.id,
                table: 'companies',
                source: 'ui',
                before_snapshot: company,
                after_snapshot: values,
            });
            
        } else {
            const companyRef = doc(collection(firestore, 'companies'));
            batch.set(companyRef, values);

            const logRef = doc(collection(firestore, 'audit_logs'));
            batch.set(logRef, {
                ts: new Date().toISOString(),
                actor_type: 'user',
                actor_id: user?.uid || null,
                action: 'create',
                entity_type: 'company',
                entity_id: companyRef.id,
                table: 'companies',
                source: 'ui',
                after_snapshot: values,
            });
        }
        
        await batch.commit();

        toast({
          title: isEditing ? 'Company Updated' : 'Company Created',
          description: `${values.name} has been ${isEditing ? 'updated' : 'added to your companies'}.`,
        });

        form.reset();
        onOpenChange(false);
    } catch (error) {
        // The permission error will be caught by the global listener
        if (!(error instanceof FirestorePermissionError)) {
             toast({
                variant: 'destructive',
                title: 'Submission Error',
                description: 'An unexpected error occurred while saving the company.',
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
          <DialogTitle>{isEditing ? 'Edit Company' : 'Create New Company'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update the details below.' : 'Fill in the details below to add a new company.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Company Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Acme Corporation" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input placeholder="https://acme.com" {...field} />
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
                {isEditing ? 'Save Changes' : 'Save Company'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
