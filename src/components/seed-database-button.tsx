'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Database, LoaderCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase/auth/use-user';
import { db } from '@/firebase/client';
import { collection, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';

const SEED_STORAGE_KEY = 'corchcrm_db_seeded';

export function SeedDatabaseButton() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSeeded, setIsSeeded] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();

  useEffect(() => {
    // Check if the database has been seeded before on component mount
    const seeded = localStorage.getItem(SEED_STORAGE_KEY);
    if (seeded === 'true') {
      setIsSeeded(true);
    }
  }, []);

  const handleSeedDatabase = async () => {
    if (!db || !user) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firestore or user not available.' });
      return;
    }
    setIsSeeding(true);
    toast({ title: 'Seeding Database...', description: 'Please wait while we populate your CRM with sample data.' });

    try {
      const batch = writeBatch(db);

      const [companiesRes, contactsRes, dealsRes, emailsRes] = await Promise.all([
        fetch('/companies_seed.csv'),
        fetch('/contacts_seed.csv'),
        fetch('/deals_seed.csv'),
        fetch('/emails_seed.csv'),
      ]);

      const [companiesCsv, contactsCsv, dealsCsv, emailsCsv] = await Promise.all([
        companiesRes.text(),
        contactsRes.text(),
        dealsRes.text(),
        emailsRes.text(),
      ]);

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

      // Process Companies, Contacts, Deals, and Emails
      parseCsv(companiesCsv).forEach(obj => obj.id && batch.set(doc(db, 'users', user.uid, 'companies', obj.id), obj));
      
      parseCsv(contactsCsv).forEach(obj => {
          if (obj.id) {
            const contactData: {[key: string]: any} = {};
            for (const key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key]) contactData[key] = obj[key]; }
            batch.set(doc(db, 'users', user.uid, 'contacts', obj.id), contactData);
          }
      });

      parseCsv(dealsCsv).forEach(obj => {
        if (obj.id) {
            const dealData: any = { ...obj };
            if (dealData.amount) dealData.amount = Number(dealData.amount);
            if (dealData.probability) dealData.probability = Number(dealData.probability);
            if (dealData.close_date) dealData.close_date = new Date(dealData.close_date);
            if (dealData.last_interaction_at) dealData.last_interaction_at = new Date(dealData.last_interaction_at);
            batch.set(doc(db, 'users', user.uid, 'deals', obj.id), dealData);
        }
      });
      
      parseCsv(emailsCsv).forEach(obj => {
        const emailRef = doc(collection(db, 'users', user.uid, 'emails'));
        const emailData: any = { ...obj, id: emailRef.id };
        Object.keys(emailData).forEach(key => { if (emailData[key] === undefined || emailData[key] === null || emailData[key] === '') delete emailData[key]; });
        if (emailData.ts && !isNaN(new Date(emailData.ts).getTime())) emailData.ts = new Date(emailData.ts); else delete emailData.ts;
        batch.set(emailRef, emailData);
      });
      
      await batch.commit();

      toast({ title: 'Database Seeded!', description: 'Your CRM has been populated with sample data.' });
      localStorage.setItem(SEED_STORAGE_KEY, 'true');
      setIsSeeded(true);
    } catch (error) {
      console.error("Seeding error:", error);
      toast({ variant: 'destructive', title: 'Seeding Failed', description: 'Could not populate the database. Check console for details.' });
    } finally {
      setIsSeeding(false);
    }
  };
  
  const isDisabled = isSeeding || isSeeded;

  return (
    <Button
      onClick={handleSeedDatabase}
      disabled={isDisabled}
      className={cn("w-full justify-center group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:p-0", {
          'bg-green-600 hover:bg-green-700': isSeeded,
          'group-data-[collapsible=icon]:w-full': !isDisabled,
          'group-data-[collapsible=icon]:w-8': isDisabled
      })}
    >
      {isSeeding ? (
        <LoaderCircle className="h-4 w-4 animate-spin group-data-[collapsible=icon]:mx-auto" />
      ) : isSeeded ? (
        <CheckCircle className="h-4 w-4 group-data-[collapsible=icon]:mx-auto" />
      ) : (
        <Database className="h-4 w-4" />
      )}
      <span className={cn("ml-2 group-data-[collapsible=icon]:hidden", {'hidden': isDisabled })}>
        Seed Database
      </span>
      <span className="sr-only">Seed Database</span>
    </Button>
  );
}