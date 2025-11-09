

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
import { CrmDetailsDialog } from '@/components/crm-details-dialog';
import { format } from 'date-fns';

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

type Email = {
    id: string;
    ts: string | Timestamp;
    from_email: string;
    to_email: string;
    direction: 'inbound' | 'outbound';
    subject: string;
    body_excerpt: string;
    labels: string;
    company_id?: string;
    deal_id?: string;
    ai_summary?: string;
};

type CrmEntity = Company | Contact | Deal;


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

const toDate = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    if (dateValue instanceof Timestamp) return dateValue.toDate();
    if (typeof dateValue === 'string') return new Date(dateValue);
    if (dateValue && typeof dateValue.seconds === 'number') {
        return new Date(dateValue.seconds * 1000);
    }
    return new Date();
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

    // Details Dialog state
    const [detailsEntity, setDetailsEntity] = useState<CrmEntity | null>(null);
    const [detailsEntityType, setDetailsEntityType] = useState<'Company' | 'Contact' | 'Deal' | null>(null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);


    const contactsQuery = useMemoFirebase(() => firestore && user ? query(collection(firestore, 'users', user.uid, 'contacts'), orderBy('full_name')) : null, [firestore, user]);
    const { data: contacts, loading: contactsLoading } = useCollection<Contact>(contactsQuery);
    
    const dealsQuery = useMemoFirebase(() => firestore && user ? query(collection(firestore, 'users', user.uid, 'deals'), orderBy('title')) : null, [firestore, user]);
    const { data: deals, loading: dealsLoading } = useCollection<Deal>(dealsQuery);

    const companiesQuery = useMemoFirebase(() => firestore && user ? query(collection(firestore, 'users', user.uid, 'companies'), orderBy('name')) : null, [firestore, user]);
    const { data: companies, loading: companiesLoading } = useCollection<Company>(companiesQuery);

    const emailsQuery = useMemoFirebase(() => firestore && user ? query(collection(firestore, 'users', user.uid, 'emails')) : null, [firestore, user]);
    const { data: emails } = useCollection<Email>(emailsQuery);


    const getContactName = (contactId: string) => {
        return contacts?.find(c => c.id === contactId)?.full_name || 'Unknown Contact';
    }
    
    const getCompany = (companyId?: string) => {
        if (!companyId) return null;
        return companies?.find(c => c.id === companyId) || null;
    }

    const handleEntityClick = (entity: CrmEntity, type: 'Company' | 'Contact' | 'Deal') => {
        setDetailsEntity(entity);
        setDetailsEntityType(type);
        setIsDetailsDialogOpen(true);
    };

    const handleSeedDatabase = async () => {
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Firestore or user not available.' });
            return;
        }
        setIsSeeding(true);
        toast({ title: 'Seeding Database...', description: 'Please wait while we populate your CRM.' });

        try {
            const batch = writeBatch(firestore);

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

            const parseCsv = (csvText: string): Record<string, string>[] => {
                const lines = csvText.trim().split(/\r?\n/);
                if (lines.length < 2) return [];
                const headerLine = lines.shift();
                if (!headerLine) return [];
                const headers = headerLine.split(',');

                return lines.map(line => {
                    if (!line.trim()) return null;
                    const values = line.split(',');
                    const obj: Record<string, string> = {};
                    headers.forEach((header, index) => {
                        obj[header] = values[index];
                    });
                    return obj;
                }).filter((obj): obj is Record<string, string> => obj !== null);
            };
            
            const companiesData = parseCsv(companiesCsv);
            companiesData.forEach(companyObj => {
                if (companyObj.id) {
                    const companyRef = doc(firestore, 'users', user.uid, 'companies', companyObj.id);
                    batch.set(companyRef, { ...companyObj });
                }
            });

            const contactsData = parseCsv(contactsCsv);
            contactsData.forEach(contactObj => {
                if (contactObj.id) {
                    const contactRef = doc(firestore, 'users', user.uid, 'contacts', contactObj.id);
                    const contactData: {[key: string]: any} = {};
                    for (const key in contactObj) {
                        if (Object.prototype.hasOwnProperty.call(contactObj, key)) {
                           if(contactObj[key]) {
                             contactData[key] = contactObj[key];
                           }
                        }
                    }
                    batch.set(contactRef, contactData);
                }
            });

            const dealsData = parseCsv(dealsCsv);
            dealsData.forEach(dealObj => {
                if (dealObj.id) {
                    const dealRef = doc(firestore, 'users', user.uid, 'deals', dealObj.id);
                    const dealData: any = { ...dealObj };
                    if (dealData.amount) dealData.amount = Number(dealData.amount);
                    if (dealData.probability) dealData.probability = Number(dealData.probability);
                    if (dealData.close_date) dealData.close_date = new Date(dealData.close_date);
                    if (dealData.last_interaction_at) dealData.last_interaction_at = new Date(dealData.last_interaction_at);
                    batch.set(dealRef, dealData);
                }
            });

            const emailsData = parseCsv(emailsCsv);
            emailsData.forEach(emailObj => {
                if (emailObj.id) {
                    const emailRef = doc(firestore, 'users', user.uid, 'emails', emailObj.id);
                    const emailData: any = { ...emailObj };
                    
                    // Validate and convert timestamp
                    if (emailData.ts && !isNaN(new Date(emailData.ts).getTime())) {
                        emailData.ts = new Date(emailData.ts);
                    } else {
                        delete emailData.ts; // Remove invalid or empty timestamp
                    }

                    batch.set(emailRef, emailData);
                }
            });
            
            await batch.commit();

            toast({ title: 'Database Seeded!', description: 'Your CRM has been populated with sample data.' });
        } catch (error) {
            console.error("Seeding error:", error);
            toast({ variant: 'destructive', title: 'Seeding Failed', description: 'Could not populate the database. Check console for details.' });
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
                        <TableHead>Amount</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Probability</TableHead>
                        <TableHead>Close Date</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {dealsLoading && <TableRow><TableCell colSpan={8}>Loading...</TableCell></TableRow>}
                    {deals?.map(deal => {
                        const company = getCompany(deal.company_id || deal.companyId);
                        return (
                        <TableRow key={deal.id}>
                            <TableCell className="font-medium">{deal.title || deal.name}</TableCell>
                            <TableCell>{getContactName(deal.primary_contact_id || deal.contactId!)}</TableCell>
                            <TableCell>
                                {company ? (
                                    <Button variant="link" className="p-0 h-auto" onClick={() => handleEntityClick(company, 'Company')}>
                                        {company.name}
                                    </Button>
                                ) : (
                                    'N/A'
                                )}
                            </TableCell>
                            <TableCell>{formatCurrency(deal.amount, deal.currency)}</TableCell>
                            <TableCell>
                                <Badge variant={stageVariant[deal.stage] || 'secondary'}>{deal.stage}</Badge>
                            </TableCell>
                            <TableCell>{deal.probability ? `${deal.probability}%` : 'N/A'}</TableCell>
                            <TableCell>{deal.close_date ? format(toDate(deal.close_date), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                            <TableCell>
                                <Button variant="ghost" size="icon" onClick={() => handleEditDeal(deal)}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </TableCell>
                        </TableRow>
                        )
                    })}
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
                        <TableHead>Title</TableHead>
                        <TableHead>Seniority</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {contactsLoading && <TableRow><TableCell colSpan={7}>Loading...</TableCell></TableRow>}
                    {contacts?.map(contact => {
                        const company = getCompany(contact.company_id || contact.companyId);
                        return (
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
                                <TableCell>{contact.phone || 'N/A'}</TableCell>
                                <TableCell>
                                    {company ? (
                                        <Button variant="link" className="p-0 h-auto" onClick={() => handleEntityClick(company, 'Company')}>
                                            {company.name}
                                        </Button>
                                    ) : (
                                        'N/A'
                                    )}
                                </TableCell>
                                <TableCell>{contact.title || 'N/A'}</TableCell>
                                <TableCell>{contact.seniority || 'N/A'}</TableCell>
                                <TableCell>
                                    <Button variant="ghost" size="icon" onClick={() => handleEditContact(contact)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )
                    })}
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
                            <TableHead>Size</TableHead>
                            <TableHead>Region</TableHead>
                            <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {companiesLoading && <TableRow><TableCell colSpan={6}>Loading...</TableCell></TableRow>}
                        {companies?.map(company => (
                            <TableRow key={company.id}>
                                <TableCell className="font-medium">{company.name}</TableCell>
                                <TableCell><a href={`http://${company.domain}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{company.domain}</a></TableCell>
                                <TableCell>{company.industry || 'N/A'}</TableCell>
                                <TableCell>{company.size || 'N/A'}</TableCell>
                                <TableCell>{company.region || 'N/A'}</TableCell>
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
    <CrmDetailsDialog
        entity={detailsEntity}
        entityType={detailsEntityType}
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        onEntityClick={handleEntityClick}
        contacts={contacts || []}
        deals={deals || []}
        emails={emails || []}
    />
    </>
  );
}
