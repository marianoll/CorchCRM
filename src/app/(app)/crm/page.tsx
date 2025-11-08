'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil, Database } from 'lucide-react';
import { CreateContactForm } from '@/components/create-contact-form';
import { CreateDealForm } from '@/components/create-deal-form';
import { CreateCompanyForm } from '@/components/create-company-form';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, doc, writeBatch, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

// Define types based on new schema
type Company = {
    id: string;
    name: string;
    domain?: string;
    industry?: string;
    size?: string;
    region?: string;
    owner_email?: string;
    website?: string; // Keeping for compatibility if old data exists
};

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
    name?: string; // For compatibility
    email?: string; // For compatibility
    companyId?: string; // For compatibility
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
    name?: string; // For compatibility
    contactId?: string; // For compatibility
    companyId?: string; // For compatibility
};


const stageVariant: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
  prospect: 'secondary',
  discovery: 'secondary',
  proposal: 'default',
  negotiation: 'default',
  won: 'default',
  lost: 'destructive',
};

const formatCurrency = (amount: number, currency: string = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

export default function CrmPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const [isCreateContactOpen, setCreateContactOpen] = useState(false);
    const [isCreateDealOpen, setCreateDealOpen] = useState(false);
    const [isCreateCompanyOpen, setCreateCompanyOpen] = useState(false);
    const [isSeeding, setIsSeeding] = useState(false);
    
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);

    const contactsQuery = useMemoFirebase(() => firestore && user ? query(collection(firestore, 'users', user.uid, 'contacts'), orderBy('full_name')) : null, [firestore, user]);
    const { data: contacts, loading: contactsLoading } = useCollection<Contact>(contactsQuery);
    
    const dealsQuery = useMemoFirebase(() => firestore && user ? query(collection(firestore, 'users', user.uid, 'deals'), orderBy('title')) : null, [firestore, user]);
    const { data: deals, loading: dealsLoading } = useCollection<Deal>(dealsQuery);

    const companiesQuery = useMemoFirebase(() => firestore && user ? query(collection(firestore, 'users', user.uid, 'companies'), orderBy('name')) : null, [firestore, user]);
    const { data: companies, loading: companiesLoading } = useCollection<Company>(companiesQuery);


    const getContactName = (contactId: string) => {
        return contacts?.find(c => c.id === contactId)?.full_name || 'Unknown Contact';
    }
    
    const getCompanyName = (companyId?: string) => {
        if (!companyId) return 'N/A';
        return companies?.find(c => c.id === companyId)?.name || 'Unknown Company';
    }

    const handleSeedDatabase = async () => {
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Firestore or user not available.' });
            return;
        }
        setIsSeeding(true);
        toast({ title: 'Seeding Database...', description: 'Please wait while we populate your CRM.' });

        try {
            const batch = writeBatch(firestore);

            // Process Companies
            const companiesRes = await fetch('/companies_seed.csv');
            const companiesCsv = await companiesRes.text();
            const companiesLines = companiesCsv.split('\n');
            const companiesHeader = companiesLines.shift()?.trim().split(',');
            if (companiesHeader) {
                for (const line of companiesLines) {
                    if (!line.trim()) continue; // Skip empty lines
                    const values = line.trim().split(',');
                    const companyObj: any = {};
                    companiesHeader.forEach((header, index) => {
                        companyObj[header] = values[index];
                    });
                    const companyRef = doc(firestore, 'users', user.uid, 'companies', companyObj.id);
                    batch.set(companyRef, { ...companyObj });
                }
            }

            // Process Contacts
            const contactsRes = await fetch('/contacts_seed.csv');
            const contactsCsv = await contactsRes.text();
            const contactsLines = contactsCsv.split('\n');
            const contactsHeader = contactsLines.shift()?.trim().split(',');
            if (contactsHeader) {
                for (const line of contactsLines) {
                    if (!line.trim()) continue; // Skip empty lines
                    const values = line.trim().split(',');
                    const contactObj: any = {};
                    contactsHeader.forEach((header, index) => {
                        contactObj[header] = values[index];
                    });
                    const contactRef = doc(firestore, 'users', user.uid, 'contacts', contactObj.id);
                     batch.set(contactRef, { ...contactObj });
                }
            }

            // Process Deals
            const dealsRes = await fetch('/deals_seed.csv');
            const dealsCsv = await dealsRes.text();
            const dealsLines = dealsCsv.split('\n');
            const dealsHeader = dealsLines.shift()?.trim().split(',');
            if (dealsHeader) {
                for (const line of dealsLines) {
                    if (!line.trim()) continue; // Skip empty lines
                    const values = line.trim().split(',');
                    const dealObj: any = {};
                    dealsHeader.forEach((header, index) => {
                         let value: any = values[index];
                        if (header === 'amount' || header === 'probability') value = Number(value);
                        if (header === 'close_date' || header === 'last_interaction_at') value = new Date(value);
                        dealObj[header] = value;
                    });
                    const dealRef = doc(firestore, 'users', user.uid, 'deals', dealObj.id);
                    batch.set(dealRef, { ...dealObj });
                }
            }
            
            await batch.commit();

            toast({ title: 'Database Seeded!', description: 'Your CRM has been populated with sample data.' });
        } catch (error) {
            console.error("Seeding error:", error);
            toast({ variant: 'destructive', title: 'Seeding Failed', description: 'Could not populate the database.' });
        } finally {
            setIsSeeding(false);
        }
    };


    const handleEditContact = (contact: Contact) => {
        setEditingContact(contact);
        setCreateContactOpen(true);
    };

    const handleEditDeal = (deal: Deal) => {
        setEditingDeal(deal);
        setCreateDealOpen(true);
    };

    const handleEditCompany = (company: Company) => {
        setEditingCompany(company);
        setCreateCompanyOpen(true);
    };

    const closeContactForm = (open: boolean) => {
        if (!open) {
            setEditingContact(null);
        }
        setCreateContactOpen(open);
    }
    const closeDealForm = (open: boolean) => {
        if (!open) {
            setEditingDeal(null);
        }
        setCreateDealOpen(open);
    }
    const closeCompanyForm = (open: boolean) => {
        if (!open) {
            setEditingCompany(null);
        }
        setCreateCompanyOpen(open);
    }


  return (
    <>
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">CRM View</h1>
                <p className="text-muted-foreground">Browse your deals, contacts and companies.</p>
            </div>
            <div className="flex gap-2">
                <Button onClick={handleSeedDatabase} disabled={isSeeding} variant="outline"><Database className="mr-2 h-4 w-4" /> Seed Database</Button>
                <Button onClick={() => { setEditingContact(null); setCreateContactOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> New Contact</Button>
                <Button onClick={() => { setEditingDeal(null); setCreateDealOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> New Deal</Button>
                <Button onClick={() => { setEditingCompany(null); setCreateCompanyOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> New Company</Button>
            </div>
        </div>

        <Tabs defaultValue="deals" className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:w-[600px]">
            <TabsTrigger value="deals">Deals</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="companies">Companies</TabsTrigger>
          </TabsList>
          <TabsContent value="deals">
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Deal Title</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {dealsLoading && <TableRow><TableCell colSpan={6}>Loading...</TableCell></TableRow>}
                    {deals?.map(deal => (
                        <TableRow key={deal.id}>
                            <TableCell className="font-medium">{deal.title || deal.name}</TableCell>
                            <TableCell>{getContactName(deal.primary_contact_id || deal.contactId!)}</TableCell>
                            <TableCell>{getCompanyName(deal.company_id || deal.companyId)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(deal.amount, deal.currency)}</TableCell>
                            <TableCell>
                                <Badge variant={stageVariant[deal.stage] || 'secondary'}>{deal.stage}</Badge>
                            </TableCell>
                            <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => handleEditDeal(deal)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </div>
          </TabsContent>
          <TabsContent value="contacts">
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {contactsLoading && <TableRow><TableCell colSpan={5}>Loading...</TableCell></TableRow>}
                    {contacts?.map(contact => (
                        <TableRow key={contact.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarFallback>{(contact.full_name || contact.name || 'U').charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{contact.full_name || contact.name}</span>
                                </div>
                            </TableCell>
                            <TableCell>{contact.email_primary || contact.email}</TableCell>
                            <TableCell>{contact.phone}</TableCell>
                            <TableCell>{getCompanyName(contact.company_id || contact.companyId)}</TableCell>
                            <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => handleEditContact(contact)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </div>
          </TabsContent>
          <TabsContent value="companies">
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Company Name</TableHead>
                            <TableHead>Domain</TableHead>
                            <TableHead>Industry</TableHead>
                            <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {companiesLoading && <TableRow><TableCell colSpan={4}>Loading...</TableCell></TableRow>}
                        {companies?.map(company => (
                            <TableRow key={company.id}>
                                <TableCell className="font-medium">{company.name}</TableCell>
                                <TableCell><a href={`http://${company.domain}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{company.domain}</a></TableCell>
                                <TableCell>{company.industry}</TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="icon" onClick={() => handleEditCompany(company)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </div>
            </TabsContent>
        </Tabs>
      </div>
    </main>

    <CreateContactForm open={isCreateContactOpen} onOpenChange={closeContactForm} contact={editingContact} companies={companies || []}/>
    <CreateDealForm open={isCreateDealOpen} onOpenChange={closeDealForm} contacts={contacts || []} companies={companies || []} deal={editingDeal} />
    <CreateCompanyForm open={isCreateCompanyOpen} onOpenChange={closeCompanyForm} company={editingCompany} />
    </>
  );
}
