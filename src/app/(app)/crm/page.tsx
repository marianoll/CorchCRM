'use client';

import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil } from 'lucide-react';
import { CreateContactForm } from '@/components/create-contact-form';
import { CreateDealForm } from '@/components/create-deal-form';
import { CreateCompanyForm } from '@/components/create-company-form';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useUser } from '@/firebase/auth/use-user';
import { collection, query, orderBy, doc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebase/client';
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


type Stage = { name: string; color: string; };

type Settings = {
    pipelineStages: Stage[];
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
    const { user, isUserLoading: userLoading } = useUser();
    const [isCreateContactOpen, setCreateContactOpen] = useState(false);
    const [isCreateDealOpen, setCreateDealOpen] = useState(false);
    const [isCreateCompanyOpen, setCreateCompanyOpen] = useState(false);
    
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);

    // Details Dialog state
    const [detailsEntity, setDetailsEntity] = useState<CrmEntity | null>(null);
    const [detailsEntityType, setDetailsEntityType] = useState<'Company' | 'Contact' | 'Deal' | null>(null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);


    const contactsQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'contacts'), orderBy('full_name')) : null, [user]);
    const { data: contacts, loading: contactsLoading } = useCollection<Contact>(contactsQuery);
    
    const dealsQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'deals'), orderBy('title')) : null, [user]);
    const { data: deals, loading: dealsLoading } = useCollection<Deal>(dealsQuery);

    const companiesQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'companies'), orderBy('name')) : null, [user]);
    const { data: companies, loading: companiesLoading } = useCollection<Company>(companiesQuery);

    const emailsQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'emails')) : null, [user]);
    const { data: emails } = useCollection<Email>(emailsQuery);

    const settingsRef = useMemo(() => user ? doc(db, 'users', user.uid, 'settings', 'user') : null, [user]);
    const { data: settings, isLoading: isLoadingSettings } = useDoc<Settings>(settingsRef);

    const stageColorMap = useMemo(() => {
        if (!settings?.pipelineStages) return {};
        return settings.pipelineStages.reduce((acc, stage) => {
            acc[stage.name] = stage.color;
            return acc;
        }, {} as Record<string, string>);
    }, [settings]);

    const getStageBadge = (stageName: string) => {
        const colorClass = stageColorMap[stageName] || 'bg-gray-400';
        // We use a Badge here but with custom styling to apply the dynamic color,
        // as Badge variants are pre-defined in CSS.
        return (
            <span className={`px-2.5 py-0.5 text-xs font-semibold text-white rounded-full ${colorClass}`}>
                {stageName}
            </span>
        );
    };


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
                    {(dealsLoading || isLoadingSettings) && <TableRow><TableCell colSpan={8}>Loading...</TableCell></TableRow>}
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
                                {getStageBadge(deal.stage)}
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
