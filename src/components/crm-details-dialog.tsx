'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Briefcase, Building, Mail, Phone, User, Users } from 'lucide-react';
import { format } from 'date-fns';
import type { Timestamp } from 'firebase/firestore';

// Types matching the CRM page
type Company = { id: string; name: string; domain?: string; industry?: string; };
type Contact = { id: string; company_id?: string; full_name: string; email_primary: string; phone?: string; title?: string; };
type Deal = { id: string; company_id?: string; primary_contact_id: string; title: string; amount: number; stage: string; close_date: Date | Timestamp | string; };

type CrmEntity = Company | Contact | Deal;

interface CrmDetailsDialogProps {
  entity: CrmEntity | null;
  entityType: 'Company' | 'Contact' | 'Deal' | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEntityClick: (entity: CrmEntity, type: 'Company' | 'Contact' | 'Deal') => void;
  // Data from parent to show relationships
  contacts: Contact[];
  deals: Deal[];
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
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

export function CrmDetailsDialog({
  entity,
  entityType,
  open,
  onOpenChange,
  onEntityClick,
  contacts,
  deals
}: CrmDetailsDialogProps) {
  
  if (!entity || !entityType) {
    return null;
  }

  const renderCompanyDetails = (company: Company) => {
    const companyContacts = contacts.filter(c => c.company_id === company.id);
    const companyDeals = deals.filter(d => d.company_id === company.id);

    return (
      <>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building /> {company.name}</DialogTitle>
          <DialogDescription>
            {company.domain && <a href={`https://${company.domain}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">{company.domain}</a>}
            {company.industry && ` • ${company.industry}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Users /> Contacts</h4>
                {companyContacts.length > 0 ? (
                    <div className="space-y-2">
                        {companyContacts.map(c => (
                            <Button key={c.id} variant="link" className="p-0 h-auto" onClick={() => onEntityClick(c, 'Contact')}>
                                {c.full_name}
                            </Button>
                        ))}
                    </div>
                ) : <p className="text-sm text-muted-foreground">No contacts found for this company.</p>}
            </div>
             <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Briefcase /> Open Deals</h4>
                {companyDeals.length > 0 ? (
                    <div className="space-y-2">
                        {companyDeals.map(d => (
                            <Button key={d.id} variant="link" className="p-0 h-auto" onClick={() => onEntityClick(d, 'Deal')}>
                                {d.title}
                            </Button>
                        ))}
                    </div>
                ) : <p className="text-sm text-muted-foreground">No deals found for this company.</p>}
            </div>
        </div>
      </>
    );
  };

  const renderContactDetails = (contact: Contact) => (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-3">
          <Avatar>
            <AvatarFallback>{contact.full_name?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          {contact.full_name}
        </DialogTitle>
        <DialogDescription>{contact.title}</DialogDescription>
      </DialogHeader>
      <div className="space-y-2 py-4">
        <p className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" /> {contact.email_primary}</p>
        {contact.phone && <p className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /> {contact.phone}</p>}
      </div>
    </>
  );

  const renderDealDetails = (deal: Deal) => {
    const contact = contacts.find(c => c.id === deal.primary_contact_id);
    return (
        <>
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Briefcase /> {deal.title}</DialogTitle>
                <DialogDescription>
                    {formatCurrency(deal.amount)}
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4 text-sm">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Stage</span>
                    <Badge>{deal.stage}</Badge>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Expected Close</span>
                    <span>{format(toDate(deal.close_date), 'PPP')}</span>
                </div>
                {contact && (
                     <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Primary Contact</span>
                         <Button variant="link" className="p-0 h-auto" onClick={() => onEntityClick(contact, 'Contact')}>
                           {contact.full_name}
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
  };

  const renderContent = () => {
    switch (entityType) {
      case 'Company':
        return renderCompanyDetails(entity as Company);
      case 'Contact':
        return renderContactDetails(entity as Contact);
      case 'Deal':
        return renderDealDetails(entity as Deal);
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {renderContent()}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
