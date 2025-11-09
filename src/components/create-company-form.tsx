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
  domain: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  region: z.string().optional(),
});

type Company = {
    id: string;
    name: string;
    domain?: string;
    industry?: string;
    size?: string;
    region?: string;
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
      domain: '',
      industry: '',
      size: '',
      region: '',
    },
  });

  const isEditing = !!company;

  useEffect(() => {
    if (isEditing && company) {
        form.reset(company);
    } else {
        form.reset({ name: '', domain: '', industry: '', size: '', region: '' });
    }
  }, [company, isEditing, form, open]);


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
    const companyData = {
        ...values,
        website: values.domain ? `https://${values.domain}` : ''
    }

    try {
        if (isEditing && company) {
            const companyRef = doc(firestore, 'users', user.uid, 'companies', company.id);
            batch.update(companyRef, companyData);

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
                after_snapshot: companyData,
            });
            
        } else {
            const companyRef = doc(collection(firestore, 'users', user.uid, 'companies'));
            batch.set(companyRef, companyData);

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
                after_snapshot: companyData,
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
        if (error instanceof FirestorePermissionError) {
             errorEmitter.emit('permission-error', error);
        } else {
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
              name="domain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Domain</FormLabel>
                  <FormControl>
                    <Input placeholder="acme.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="industry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Industry</FormLabel>
                  <FormControl>
                    <Input placeholder="SaaS" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Size</FormLabel>
                  <FormControl>
                    <Input placeholder="11-50 employees" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Region</FormLabel>
                  <FormControl>
                    <Input placeholder="North America" {...field} />
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
