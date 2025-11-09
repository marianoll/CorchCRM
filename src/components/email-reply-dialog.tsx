
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { LoaderCircle, Send, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/firebase/client';
import { collection, writeBatch, doc, Timestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { format, addDays } from 'date-fns';
import type { User } from 'firebase/auth';

type Email = {
    id: string;
    ts: string | Timestamp;
    from_email: string;
    to_email: string;
    direction: 'inbound' | 'outbound';
    subject: string;
    body_excerpt: string;
};

type ActionStatus = 'approved' | 'rejected';

interface EmailReplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (status: ActionStatus) => void;
  email: Email;
  user: User;
}

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

export function EmailReplyDialog({
  open,
  onOpenChange,
  onStatusChange,
  email,
  user,
}: EmailReplyDialogProps) {
  const [draft, setDraft] = useState({ from: '', to: '', subject: '', body: '', date: new Date() });
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && email && user) {
      const isReplying = email.direction === 'inbound';
      const subjectPrefix = email.subject.toLowerCase().startsWith('re:') ? '' : 'Re: ';
      const originalEmailDate = toDate(email.ts);

      setDraft({
        from: user.email || '',
        to: isReplying ? email.from_email : email.to_email,
        subject: isReplying ? `${subjectPrefix}${email.subject}` : `Following up on: ${email.subject}`,
        date: isReplying ? addDays(originalEmailDate, 1) : addDays(originalEmailDate, 5),
        body: isReplying 
            ? `Hi,

Thanks for your email regarding "${email.subject}".

Best,
${user.displayName?.split(' ')[0] || ''}`
            : `Hi,

I'm just following up to see if you've had a chance to review my previous email regarding "${email.subject}".

Let me know if you have any questions.

Best,
${user.displayName?.split(' ')[0] || ''}`
      });
    }
  }, [open, email, user]);
  
  const handleAction = async (status: ActionStatus) => {
    onStatusChange(status);
    onOpenChange(false);
    
    if (status === 'rejected') {
        toast({ title: 'Action Rejected', variant: 'default' });
        return;
    }

    if (!db || !user) {
        toast({ title: 'Error', description: 'User or database not available.' });
        return;
    }
    
    setIsSaving(true);
    const batch = writeBatch(db);

    try {
        // Log Simulated Email "Send"
        const sendLogRef = doc(collection(db, 'audit_logs'));
        batch.set(sendLogRef, {
            ts: draft.date.toISOString(),
            actor_type: 'system_ai', 
            actor_id: user.uid,
            action: 'send_email',
            entity_type: 'emails',
            entity_id: `simulated_send_${Date.now()}`,
            table: 'emails',
            source: 'ui-reply-generator',
            after_snapshot: {
                to: draft.to,
                from: draft.from,
                subject: draft.subject,
                body: draft.body,
            }
        });
        
        await batch.commit();

        toast({
            title: 'Reply Approved!',
            description: `An email sending action has been logged for ${format(draft.date, 'PP')}.`
        });
        
    } catch (error) {
        const contextualError = new FirestorePermissionError({
            path: 'audit_logs',
            operation: 'create',
            requestResourceData: { action: 'send_email' },
        });
        errorEmitter.emit('permission-error', contextualError);
    } finally {
        setIsSaving(false);
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate Email Reply</DialogTitle>
          <DialogDescription>
            Review and approve the generated email draft below.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="from">From</Label>
                <Input id="from" value={draft.from} readOnly disabled />
            </div>
            <div className="space-y-2">
                <Label htmlFor="to">To</Label>
                <Input id="to" value={draft.to} readOnly disabled />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Scheduled Date</Label>
            <Input id="date" value={format(draft.date, 'PPP p')} readOnly disabled />
          </div>
           <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input id="subject" value={draft.subject} onChange={(e) => setDraft(d => ({ ...d, subject: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="body">Body</Label>
            <Textarea 
              id="body" 
              value={draft.body} 
              onChange={(e) => setDraft(d => ({ ...d, body: e.target.value }))}
              rows={10} 
            />
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="destructive" onClick={() => handleAction('rejected')} disabled={isSaving}>
            <X className="mr-2 h-4 w-4" />
            Reject
          </Button>
           <Button onClick={() => handleAction('approved')} disabled={isSaving} className="bg-green-600 hover:bg-green-700 text-white">
            {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Approve & Log Send Action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
