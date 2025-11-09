'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Database, LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase/auth/use-user';
import { db } from '@/firebase/client';
import { collection, doc, writeBatch, Timestamp } from 'firebase/firestore';

interface WelcomeSeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSeeded: () => void;
}

export function WelcomeSeedDialog({ open, onOpenChange, onSeeded }: WelcomeSeedDialogProps) {
  const [isSeeding, setIsSeeding] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();

  const handleSeedDatabase = async () => {
    if (!db || !user) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firestore or user not available.' });
      return;
    }
    setIsSeeding(true);
    toast({ title: 'Seeding Database...', description: 'Please wait while we populate your CRM with sample data.' });

    try {
      const batch = writeBatch(db);

      // Fetch all CSV files
      const [companiesRes, contactsRes, dealsRes, emailsRes] = await Promise.all([
          fetch('/companies_seed.csv'),
          fetch('/contacts_seed.csv'),
          fetch('/deals_seed.csv'),
          fetch('/emails_seed.csv')
      ]);

      const [companiesCsv, contactsCsv, dealsCsv, emailsCsv] = await Promise.all([
          companiesRes.text(),
          contactsRes.text(),
          dealsRes.text(),
          emailsRes.text()
      ]);

      // Helper function to parse CSV text
      const parseCsv = (csvText: string): Record<string, string>[] => {
          const lines = csvText.trim().replace(/\r/g, '').split('\n');
          if (lines.length < 2) return [];
          const headerLine = lines.shift();
          if (!headerLine) return [];
          const headers = headerLine.split(',');

          return lines.map(line => {
              if (!line.trim()) return null;
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

      // Process Companies
      const companiesData = parseCsv(companiesCsv);
      companiesData.forEach(companyObj => {
          if (companyObj.id) {
              const companyRef = doc(db, 'users', user.uid, 'companies', companyObj.id);
              batch.set(companyRef, { ...companyObj });
          }
      });

      // Process Contacts
      const contactsData = parseCsv(contactsCsv);
      contactsData.forEach(contactObj => {
          if (contactObj.id) {
              const contactRef = doc(db, 'users', user.uid, 'contacts', contactObj.id);
              const contactData: {[key: string]: any} = {};
              for (const key in contactObj) {
                  if (Object.prototype.hasOwnProperty.call(contactObj, key) && contactObj[key]) {
                      contactData[key] = contactObj[key];
                  }
              }
              batch.set(contactRef, contactData);
          }
      });
      
      // Process Deals
      const dealsData = parseCsv(dealsCsv);
      dealsData.forEach(dealObj => {
          if (dealObj.id) {
              const dealRef = doc(db, 'users', user.uid, 'deals', dealObj.id);
              const dealData: any = { ...dealObj };
              if (dealData.amount) dealData.amount = Number(dealData.amount);
              if (dealData.probability) dealData.probability = Number(dealData.probability);
              if (dealData.close_date) dealData.close_date = new Date(dealData.close_date);
              if (dealData.last_interaction_at) dealData.last_interaction_at = new Date(dealData.last_interaction_at);
              batch.set(dealRef, dealData);
          }
      });

      // Process Emails
      const emailsData = parseCsv(emailsCsv);
      emailsData.forEach(emailObj => {
          const emailRef = doc(collection(db, 'users', user.uid, 'emails'));
          const emailData: any = { ...emailObj, id: emailRef.id };
          Object.keys(emailData).forEach(key => {
              if (emailData[key] === undefined || emailData[key] === null || emailData[key] === '') delete emailData[key];
          });
          if (emailData.ts && !isNaN(new Date(emailData.ts).getTime())) {
            emailData.ts = new Date(emailData.ts);
          } else {
            delete emailData.ts; 
          }
          batch.set(emailRef, emailData);
      });
      
      await batch.commit();

      toast({ title: 'Database Seeded!', description: 'Your CRM has been populated with sample data.' });
      onSeeded(); // Close modal and set flag
    } catch (error) {
      console.error("Seeding error:", error);
      toast({ variant: 'destructive', title: 'Seeding Failed', description: 'Could not populate the database. Check console for details.' });
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()} hideCloseButton>
        <DialogHeader>
          <DialogTitle className="text-xl">Welcome to CorchCRM!</DialogTitle>
          <DialogDescription>
            To get started and see the app in action, you need to populate it with some sample data. This will create contacts, deals, companies and email history for you to explore.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={handleSeedDatabase} disabled={isSeeding} className="w-full">
            {isSeeding ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Database className="mr-2 h-4 w-4" />
            )}
            Populate Sample Data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Add hideCloseButton prop to DialogContent for more control
import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const OriginalDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { hideCloseButton?: boolean }
>(({ className, children, hideCloseButton, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg',
        className
      )}
      {...props}
    >
      {children}
      {!hideCloseButton && (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
OriginalDialogContent.displayName = 'DialogContentWithCloseOption';

// We extend the original DialogContent to include our custom logic
(WelcomeSeedDialog as any).DialogContent = OriginalDialogContent;
