'use client';

import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { CreateContactForm } from '@/components/create-contact-form';
import { CreateDealForm } from '@/components/create-deal-form';
import { CreateCompanyForm } from '@/components/create-company-form';
import { useCollection } from '@/firebase';
import { collection, query, orderBy, where, Firestore } from 'firebase/firestore';
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

    const contactsQuery = useMemo(() => firestore ? query(collection(firestore as Firestore, 'contacts'), orderBy('name')) : null, [firestore]);
    const { data: contacts, loading: contactsLoading } = useCollection<Contact>(contactsQuery);
    
    const dealsQuery = useMemo(() => firestore ? query(collection(firestore as Firestore, 'deals'), orderBy('name')) : null, [firestore]);
    const { data: deals, loading: dealsLoading } = useCollection<Deal>(dealsQuery);

    const companiesQuery = useMemo(() => firestore ? query(collection(firestore as Firestore, 'companies'), orderBy('name')) : null, [firestore]);
    const { data: companies, loading: companiesLoading } = useCollection<Company>(companiesQuery);

    const getContactName = (contactId: string) => {
        return contacts?.find(c => c.id === contactId)?.name || 'Unknown Contact';
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
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {dealsLoading && <TableRow><TableCell colSpan={4}>Loading...</TableCell></TableRow>}
                    {deals?.map(deal => (
                        <TableRow key={deal.id}>
                        <TableCell className="font-medium">{deal.name}</TableCell>
                        <TableCell>{getContactName(deal.contactId)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(deal.amount)}</TableCell>
                        <TableCell>
                            <Badge variant={stageVariant[deal.stage] || 'secondary'}>{deal.stage}</Badge>
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
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {contactsLoading && <TableRow><TableCell colSpan={3}>Loading...</TableCell></TableRow>}
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
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {companiesLoading && <TableRow><TableCell colSpan={2}>Loading...</TableCell></TableRow>}
                        {companies?.map(company => (
                            <TableRow key={company.id}>
                            <TableCell className="font-medium">{company.name}</TableCell>
                            <TableCell><a href={company.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{company.website}</a></TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </div>
            </TabsContent>
        </Tabs>
      </div>
    </main>

    <CreateContactForm open={isCreateContactOpen} onOpenChange={setCreateContactOpen} />
    <CreateDealForm open={isCreateDealOpen} onOpenChange={setCreateDealOpen} contacts={contacts || []} />
    <CreateCompanyForm open={isCreateCompanyOpen} onOpenChange={setCreateCompanyOpen} />
    </>
  );
}
