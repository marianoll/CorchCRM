'use client';

import { useState } from 'react';
import { contactData, dealData, type Contact, type Deal } from '@/lib/mock-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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
    const [deals, setDeals] = useState<Deal[]>(dealData);
    const [contacts, setContacts] = useState<Contact[]>(contactData);

    const sortDeals = (sortBy: keyof Deal) => {
        const sorted = [...deals].sort((a, b) => {
          if (a[sortBy] < b[sortBy]) return -1;
          if (a[sortBy] > b[sortBy]) return 1;
          return 0;
        });
        setDeals(sorted);
      };
      
      const sortContacts = (sortBy: keyof Contact) => {
        const sorted = [...contacts].sort((a, b) => {
          if (a[sortBy] < b[sortBy]) return -1;
          if (a[sortBy] > b[sortBy]) return 1;
          return 0;
        });
        setContacts(sorted);
      };

  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline">CRM View</h1>
                <p className="text-muted-foreground">Browse your automatically created deals and contacts.</p>
            </div>
            {/* Sorting is per-table now for clarity */}
        </div>

        <Tabs defaultValue="deals" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
            <TabsTrigger value="deals">Deals</TabsTrigger>
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
          </TabsList>
          <TabsContent value="deals">
            <div className="flex justify-end mb-4">
                <Select onValueChange={(value) => sortDeals(value as keyof Deal)}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Sort by..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="amount">Amount</SelectItem>
                        <SelectItem value="closeDate">Close Date</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Deal Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Close Date</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {deals.map(deal => (
                        <TableRow key={deal.id}>
                        <TableCell className="font-medium">{deal.name}</TableCell>
                        <TableCell>{deal.contact}</TableCell>
                        <TableCell className="text-right">{formatCurrency(deal.amount)}</TableCell>
                        <TableCell>
                            <Badge variant={stageVariant[deal.stage] || 'secondary'}>{deal.stage}</Badge>
                        </TableCell>
                        <TableCell>{deal.closeDate}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </div>
          </TabsContent>
          <TabsContent value="contacts">
          <div className="flex justify-end mb-4">
                <Select onValueChange={(value) => sortContacts(value as keyof Contact)}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Sort by..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="name">Name</SelectItem>
                        <SelectItem value="company">Company</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {contacts.map(contact => (
                        <TableRow key={contact.id}>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Avatar>
                                        <AvatarImage src={contact.avatar} />
                                        <AvatarFallback>{contact.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="font-medium">{contact.name}</span>
                                </div>
                            </TableCell>
                        <TableCell>{contact.company}</TableCell>
                        <TableCell>{contact.email}</TableCell>
                        <TableCell>{contact.phone}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
