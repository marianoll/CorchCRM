
'use client';

import { InfoshardProcessor } from '@/components/infoshard-processor';
import { RecentActivity } from '@/components/recent-activity';
import { UpcomingTasks } from '@/components/upcoming-tasks';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';


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
  const firestore = useFirestore();
  const { user } = useUser();

  // Fetch all CRM data needed for the infoshard processor context
  const contactsQuery = useMemoFirebase(() => firestore && user ? query(collection(firestore, 'users', user.uid, 'contacts')) : null, [firestore, user]);
  const { data: contacts, loading: contactsLoading } = useCollection<Contact>(contactsQuery);
  
  const dealsQuery = useMemoFirebase(() => firestore && user ? query(collection(firestore, 'users', user.uid, 'deals')) : null, [firestore, user]);
  const { data: deals, loading: dealsLoading } = useCollection<Deal>(dealsQuery);

  const companiesQuery = useMemoFirebase(() => firestore && user ? query(collection(firestore, 'users', user.uid, 'companies')) : null, [firestore, user]);
  const { data: companies, loading: companiesLoading } = useCollection<Company>(companiesQuery);


  const crmData = {
      contacts: contacts?.map(c => ({ id: c.id, name: c.full_name || c.name || '' })) || [],
      companies: companies?.map(c => ({ id: c.id, name: c.name })) || [],
      deals: deals?.map(d => ({ id: d.id, name: d.title || d.name || '' })) || [],
  };

  const crmDataLoading = contactsLoading || dealsLoading || companiesLoading;


  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-6 font-headline">
          Home Dashboard
        </h1>
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <div className="xl:col-span-2">
                <InfoshardProcessor crmData={crmData} crmDataLoading={crmDataLoading} />
            </div>
            <div className="space-y-6">
                <RecentActivity />
                <UpcomingTasks />
            </div>
        </div>
      </div>
    </main>
  );
}
