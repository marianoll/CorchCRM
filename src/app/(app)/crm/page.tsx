'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PlusCircle, Pencil } from 'lucide-react';
import { CreateContactForm } from '@/components/create-contact-form';
import { CreateDealForm } from '@/components/create-deal-form';
import { CreateCompanyForm } from '@/components/create-company-form';
import { useCollection } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { useMemo } from 'react';

// Define types based on backend.json
type Contact = {
    id: string;
    name: string;
    email: string;
    phone?: string;
    companyId?: string;
  };
  
type Deal = {
    id: string;
    name: string;
    amount: number;
    stage: 'lead' | 'contacted' | 'proposal' | 'negotiation' | 'won' | 'lost';
    contactId: string;
    companyId?: string;
};

type Company = {
    id: string;
    name: string;
    website?: string;
};

const stageVariant: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
  lead: 'secondary',
  contacted: 'secondary',
  proposal: 'default',
  negotiation: 'default',
  won: 'default',
  lost: 'destructive',
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export default function CrmPage() {
    const firestore = useFirestore();
    const [isCreateContactOpen, setCreateContactOpen] = useState(false);
    const [isCreateDealOpen, setCreateDealOpen] = useState(false);
    const [isCreateCompanyOpen, setCreateCompanyOpen] = useState(false);
    
    const [editingContact, setEditingContact] = useState<Contact | null>(null);
    const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);

    const contactsQuery = useMemo(() => firestore ? query(collection(firestore, 'contacts'), orderBy('name')) : null, [firestore]);
    const { data: contacts, loading: contactsLoading } = useCollection<Contact>(contactsQuery);
    
    const dealsQuery = useMemo(() => firestore ? query(collection(firestore, 'deals'), orderBy('name')) : null, [firestore]);
    const { data: deals, loading: dealsLoading } = useCollection<Deal>(dealsQuery);

    const companiesQuery = useMemo(() => firestore ? query(collection(firestore, 'companies'), orderBy('name')) : null, [firestore]);
    const { data: companies, loading: companiesLoading } = useCollection<Company>(companiesQuery);

    const getContactName = (contactId: string) => {
        return contacts?.find(c => c.id === contactId)?.name || 'Unknown Contact';
    }

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
                <Button onClick={() => setCreateContactOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> New Contact</Button>
                <Button onClick={() => setCreateDealOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> New Deal</Button>
                <Button onClick={() => setCreateCompanyOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> New Company</Button>
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
                        <TableHead>Deal Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {dealsLoading && <TableRow><TableCell colSpan={5}>Loading...</TableCell></TableRow>}
                    {deals?.map(deal => (
                        <TableRow key={deal.id}>
                            <TableCell className="font-medium">{deal.name}</TableCell>
                            <TableCell>{getContactName(deal.contactId)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(deal.amount)}</TableCell>
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
                        <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {contactsLoading && <TableRow><TableCell colSpan={4}>Loading...</TableCell></TableRow>}
                    {contacts?.map(contact => (
                        <TableRow key={contact.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{contact.name}</span>
                                </div>
                            </TableCell>
                            <TableCell>{contact.email}</TableCell>
                            <TableCell>{contact.phone}</TableCell>
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
                            <TableHead>Website</TableHead>
                            <TableHead className="w-[80px]">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {companiesLoading && <TableRow><TableCell colSpan={3}>Loading...</TableCell></TableRow>}
                        {companies?.map(company => (
                            <TableRow key={company.id}>
                                <TableCell className="font-medium">{company.name}</TableCell>
                                <TableCell><a href={company.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{company.website}</a></TableCell>
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

    <CreateContactForm open={isCreateContactOpen} onOpenChange={closeContactForm} contact={editingContact} />
    <CreateDealForm open={isCreateDealOpen} onOpenChange={closeDealForm} contacts={contacts || []} companies={companies || []} deal={editingDeal} />
    <CreateCompanyForm open={isCreateCompanyOpen} onOpenChange={closeCompanyForm} company={editingCompany} />
    </>
  );
}
