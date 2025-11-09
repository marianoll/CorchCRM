'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoaderCircle, Sparkles, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/firebase/client';
import { collection, writeBatch, doc, Timestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import type { User } from 'firebase/auth';
import { analyzeEmailContent, type AnalysisOutput } from '@/ai/flows/analyze-email-flow';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Label } from './ui/label';

type Email = {
    id: string;
    subject: string;
    body_excerpt: string;
};

type Deal = {
    id: string;
    title: string;
    stage: string;
    amount: number;
};

type ActionStatus = 'approved' | 'rejected';

interface AnalyzeEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (status: ActionStatus) => void;
  email: Email;
  deal: Deal | null;
  user: User;
}

export function AnalyzeEmailDialog({
  open,
  onOpenChange,
  onStatusChange,
  email,
  deal,
  user,
}: AnalyzeEmailDialogProps) {
  const [analysisResult, setAnalysisResult] = useState<AnalysisOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open && email && deal) {
      setIsLoading(true);
      startTransition(async () => {
        try {
          const result = await analyzeEmailContent({
            emailBody: email.body_excerpt,
            emailSubject: email.subject,
            currentDeal: deal,
          });
          setAnalysisResult(result);
        } catch (err: any) {
          toast({ variant: 'destructive', title: 'Analysis Failed', description: err.message });
          onOpenChange(false);
        } finally {
          setIsLoading(false);
        }
      });
    } else {
        setAnalysisResult(null); // Reset on close
    }
  }, [open, email, deal, toast, onOpenChange]);
  
  const handleApproval = async () => {
    if (!analysisResult?.stageSuggestion && (!analysisResult?.dataUpdates || analysisResult.dataUpdates.length === 0)) {
        toast({ title: 'No actions to approve' });
        onOpenChange(false);
        return;
    }
    
    let approvedSomething = false;
    // We could batch all approved changes, but for simplicity let's handle one by one
    if (analysisResult.stageSuggestion) {
        await handleStageUpdate();
        approvedSomething = true;
    }
    if (analysisResult.dataUpdates) {
        for (const update of analysisResult.dataUpdates) {
            await handleDataUpdate(update);
            approvedSomething = true;
        }
    }
    
    if (approvedSomething) {
      onStatusChange('approved');
    }
    onOpenChange(false);
  };
  
  const handleRejection = () => {
    onStatusChange('rejected');
    onOpenChange(false);
    toast({ title: 'Suggestions Rejected', variant: 'default' });
  };


  const handleStageUpdate = async () => {
    if (!db || !user || !deal || !analysisResult?.stageSuggestion) return;

    setIsSaving(true);
    const { newStage } = analysisResult.stageSuggestion;
    const changes = { stage: newStage };

    const batch = writeBatch(db);
    const dealRef = doc(db, 'users', user.uid, 'deals', deal.id);
    batch.update(dealRef, changes);

    const logRef = doc(collection(db, 'audit_logs'));
    batch.set(logRef, {
        ts: new Date().toISOString(),
        actor_type: 'system_ai',
        actor_id: user.uid,
        action: 'update',
        entity_type: 'deals',
        entity_id: deal.id,
        table: 'deals',
        source: 'ui-suggestion',
        before_snapshot: { stage: deal.stage },
        after_snapshot: changes,
    });
    
    try {
        await batch.commit();
        toast({ title: 'Deal Stage Updated!', description: `Stage moved to ${newStage}.` });
        setAnalysisResult(prev => prev ? { ...prev, stageSuggestion: undefined } : null); // Remove suggestion
    } catch (e) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: dealRef.path, operation: 'update', requestResourceData: changes }));
    } finally {
        setIsSaving(false);
    }
  };

  const handleDataUpdate = async (update: NonNullable<AnalysisOutput['dataUpdates']>[0]) => {
     if (!db || !user || !deal) return;

    setIsSaving(true);
    const changes = { [update.field]: update.suggestedValue };

    const batch = writeBatch(db);
    const dealRef = doc(db, 'users', user.uid, 'deals', deal.id);
    batch.update(dealRef, changes);
    
    const logRef = doc(collection(db, 'audit_logs'));
    batch.set(logRef, {
        ts: new Date().toISOString(),
        actor_type: 'system_ai',
        actor_id: user.uid,
        action: 'update',
        entity_type: 'deals',
        entity_id: deal.id,
        table: 'deals',
        source: 'ui-suggestion',
        before_snapshot: { [update.field]: update.currentValue },
        after_snapshot: changes,
    });

    try {
        await batch.commit();
        toast({ title: 'Deal Data Updated!', description: `Field ${update.field} updated.` });
        setAnalysisResult(prev => prev ? {
            ...prev,
            dataUpdates: prev.dataUpdates?.filter(u => u !== update)
        } : null);
    } catch (e) {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: dealRef.path, operation: 'update', requestResourceData: changes }));
    } finally {
        setIsSaving(false);
    }
  }

  const hasSuggestions = analysisResult?.stageSuggestion || (analysisResult?.dataUpdates && analysisResult.dataUpdates.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="text-primary"/> AI Analysis</DialogTitle>
          <DialogDescription>
            AI-powered suggestions for the deal "{deal?.title}" based on the latest email.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6 max-h-[60vh] overflow-y-auto">
          {isLoading && (
            <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
              <LoaderCircle className="h-8 w-8 animate-spin mb-3" />
              <p>Analyzing email content...</p>
            </div>
          )}

          {!isLoading && !hasSuggestions && (
             <div className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                <p>No specific stage or data updates were suggested by the AI for this email.</p>
            </div>
          )}

          {analysisResult?.stageSuggestion && (
            <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertTitle>Stage Change Suggestion</AlertTitle>
                <AlertDescription>
                    <p className="mb-3">{analysisResult.stageSuggestion.reason}</p>
                    <div className="flex items-center gap-4 mb-3">
                        <Badge variant="outline">{(deal?.stage || '').toLowerCase()}</Badge>
                        <span>→</span>
                        <Badge>{analysisResult.stageSuggestion.newStage.toLowerCase()}</Badge>
                    </div>
                    <div className="space-y-2">
                        <Label>Confidence: {Math.round(analysisResult.stageSuggestion.probability * 100)}%</Label>
                        <Progress value={analysisResult.stageSuggestion.probability * 100} />
                    </div>
                </AlertDescription>
            </Alert>
          )}

           {analysisResult?.dataUpdates && analysisResult.dataUpdates.length > 0 && (
            <div className="space-y-4">
                 {analysisResult.dataUpdates.map((update, index) => (
                    <Alert key={index} variant="default">
                         <Sparkles className="h-4 w-4" />
                        <AlertTitle>Data Update Suggestion: <span className="font-mono text-primary">{update.field}</span></AlertTitle>
                        <AlertDescription>
                             <p className="mb-3">{update.reason}</p>
                             <div className="flex items-center gap-4 mb-3 p-2 bg-muted rounded-md">
                                <span className="text-sm line-through text-muted-foreground">{String(update.currentValue)}</span>
                                <span>→</span>
                                <span className="text-sm font-semibold">{String(update.suggestedValue)}</span>
                            </div>
                        </AlertDescription>
                    </Alert>
                ))}
            </div>
           )}

        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleRejection}>Reject All</Button>
          <Button onClick={handleApproval} disabled={isSaving || isLoading || !hasSuggestions} className="bg-green-600 hover:bg-green-700 text-white">
            {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
            Approve All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
