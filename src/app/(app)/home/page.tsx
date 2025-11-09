'use client';

import { useMemo, useState, useEffect } from 'react';
import { InfoshardProcessor } from '@/components/infoshard-processor';
import { RecentActivity } from '@/components/recent-activity';
import { UpcomingTasks } from '@/components/upcoming-tasks';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useUser } from '@/firebase/auth/use-user';
import { db } from '@/firebase/client';
import { collection, query } from 'firebase/firestore';
import { FileToCrmProcessor } from '@/components/file-to-crm-processor';
import { WelcomeSeedDialog } from '@/components/welcome-seed-dialog';


// Define types based on new schema
type Company = {
    id: string;
    name: string;
    [key: string]: any;
};

type Contact = {
    id: string;
    full_name: string;
    name?: string; // for compatibility
    [key: string]: any;
};

type Deal = {
    id: string;
    title: string;
    name?: string; // for compatibility
    [key: string]: any;
};

export default function HomePage() {
  const { user } = useUser();
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    // Check if the user has seen the welcome modal before
    const hasSeenModal = localStorage.getItem('corchcrm_welcome_modal_seen');
    if (!hasSeenModal) {
      setShowWelcomeModal(true);
    }
  }, []);

  const handleModalClose = () => {
    localStorage.setItem('corchcrm_welcome_modal_seen', 'true');
    setShowWelcomeModal(false);
  };

  // Fetch all CRM data needed for the infoshard processor context
  const contactsQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'contacts')) : null, [user]);
  const { data: contacts, loading: contactsLoading } = useCollection<Contact>(contactsQuery);
  
  const dealsQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'deals')) : null, [user]);
  const { data: deals, loading: dealsLoading } = useCollection<Deal>(dealsQuery);

  const companiesQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'companies')) : null, [user]);
  const { data: companies, loading: companiesLoading } = useCollection<Company>(companiesQuery);


  const crmData = {
      contacts: contacts?.map(c => ({ id: c.id, name: c.full_name || c.name || '' })) || [],
      companies: companies?.map(c => ({ id: c.id, name: c.name })) || [],
      deals: deals?.map(d => ({ id: d.id, name: d.title || d.name || '' })) || [],
  };

  const crmDataLoading = contactsLoading || dealsLoading || companiesLoading;


  return (
    <>
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-6 font-headline">
          Unstructured Data Input
        </h1>
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <div className="xl:col-span-2 space-y-6">
                <InfoshardProcessor crmData={crmData} crmDataLoading={crmDataLoading} />
                <FileToCrmProcessor crmData={crmData} crmDataLoading={crmDataLoading} />
            </div>
            <div className="space-y-6">
                <RecentActivity />
                <UpcomingTasks />
            </div>
        </div>
      </div>
    </main>
    <WelcomeSeedDialog open={showWelcomeModal} onOpenChange={setShowWelcomeModal} onSeeded={handleModalClose}/>
    </>
  );
}
