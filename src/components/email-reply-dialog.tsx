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
import { LoaderCircle, Send } from 'lucide-react';
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

interface EmailReplyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: Email;
  user: User;
}

export function EmailReplyDialog({
  open,
  onOpenChange,
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

      setDraft({
        from: user.email || '',
        to: isReplying ? email.from_email : email.to_email,
        subject: isReplying ? `${subjectPrefix}${email.subject}` : `Following up on: ${email.subject}`,
        date: isReplying ? new Date() : addDays(new Date(), 5),
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
  
  const handleApproveAndSave = async () => {
    if (!db || !user) {
        toast({ title: 'Error', description: 'User or database not available.' });
        return;
    }
    
    setIsSaving(true);
    const batch = writeBatch(db);

    try {
        const draftRef = doc(collection(db, 'users', user.uid, 'ai_drafts'));
        const draftData = {
            id: draftRef.id,
            source_type: 'email_reply',
            related_id: email.id,
            draft_text: draft.body,
            to: draft.to,
            from: draft.from,
            subject: draft.subject,
            scheduled_at: draft.date.toISOString(),
            status: 'draft',
            createdAt: new Date().toISOString(),
            userId: user.uid,
        };
        batch.set(draftRef, draftData);
        
        // Log Draft Creation
        const createLogRef = doc(collection(db, 'audit_logs'));
        batch.set(createLogRef, {
            ts: new Date().toISOString(),
            actor_type: 'user', 
            actor_id: user.uid,
            action: 'create_ai_draft',
            entity_type: 'ai_drafts',
            entity_id: draftRef.id,
            table: 'ai_drafts',
            source: 'ui-reply-generator',
            after_snapshot: draftData
        });

        // Log Simulated Email "Send"
        const sendLogRef = doc(collection(db, 'audit_logs'));
        batch.set(sendLogRef, {
            ts: draft.date.toISOString(),
            actor_type: 'system_ai', 
            actor_id: user.uid,
            action: 'send_email',
            entity_type: 'emails',
            entity_id: draftRef.id, // Reference the draft that triggered this
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
            title: 'Draft Saved!',
            description: `A draft reply has been saved and a send action was logged.`
        });
        
        onOpenChange(false);

    } catch (error) {
        const contextualError = new FirestorePermissionError({
            path: 'ai_drafts or audit_logs',
            operation: 'create',
            requestResourceData: draft,
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
           <Button onClick={handleApproveAndSave} disabled={isSaving}>
            {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Approve & Save Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
