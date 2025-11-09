'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LoaderCircle, Check, X, Bot } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore } from '@/firebase';
import { collection, writeBatch, doc } from 'firebase/firestore';
import type { OrchestratorOutput, Action } from '@/ai/flows/orchestrator-flow';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';

interface OrchestratorSuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processFunction: () => Promise<OrchestratorOutput | null>;
}

export function OrchestratorSuggestionDialog({
  open,
  onOpenChange,
  processFunction,
}: OrchestratorSuggestionDialogProps) {
  const [result, setResult] = useState<OrchestratorOutput | null>(null);
  const [selectedActions, setSelectedActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const fetchData = useCallback(() => {
    if (open) {
      setResult(null);
      setSelectedActions([]);
      setIsLoading(true);
      processFunction()
        .then(res => {
            setResult(res);
            if(res?.actions) {
                // Pre-select actions with high confidence
                setSelectedActions(res.actions.filter(a => (a.confidence || 0) > 0.8));
            }
        })
        .catch(err => {
            console.error(err);
            toast({
                variant: 'destructive',
                title: 'Processing Failed',
                description: err.message || 'There was a problem with the AI.',
            });
            onOpenChange(false);
        })
        .finally(() => {
            setIsLoading(false);
        });
    }
  }, [open, processFunction, toast, onOpenChange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handleActionToggle = (action: Action, checked: boolean) => {
    setSelectedActions(prev => 
        checked ? [...prev, action] : prev.filter(a => a !== action)
    );
  }

  const handleApprove = async () => {
    if (selectedActions.length === 0 || !firestore || !user) {
        toast({ title: 'No actions selected.', description: 'Please select at least one action to approve.' });
        return;
    }

    setIsSaving(true);
    const batch = writeBatch(firestore);

    // In a real app, this is where you'd have a sophisticated system
    // to execute each action type. For now, we'll log them as "approved"
    // and create a history entry.

    selectedActions.forEach(action => {
        const logRef = doc(collection(firestore, 'audit_logs'));
        batch.set(logRef, {
            ts: new Date().toISOString(),
            actor_type: 'system_ai',
            actor_id: user.uid,
            action: action.type,
            entity_type: action.target,
            entity_id: action.id || 'new',
            table: action.target,
            source: 'ui',
            after_snapshot: action.data || action.changes
        });
    });

    try {
        await batch.commit();
        toast({
            title: 'Actions Approved!',
            description: `${selectedActions.length} actions have been logged and will be executed.`
        });
        onOpenChange(false);
    } catch (error) {
         if (error instanceof FirestorePermissionError) {
             errorEmitter.emit('permission-error', error);
        } else {
             toast({
                variant: 'destructive',
                title: 'Save Error',
                description: 'Could not save the approved actions.',
            });
        }
    } finally {
        setIsSaving(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="text-primary" />
            Orchestrator Suggestions
          </DialogTitle>
          <DialogDescription>
            Review and approve the actions suggested by the AI based on the email content.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {isLoading && (
            <div className="flex flex-col items-center justify-center rounded-lg p-12 text-center">
              <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
              <span className="text-muted-foreground">Orchestrating...</span>
            </div>
          )}

          {result && (
            <div className="space-y-4 rounded-lg border bg-secondary/50 p-4">
              <div>
                <h4 className="font-semibold text-sm mb-2">Suggested Actions:</h4>
                {result.actions.length > 0 ? (
                 <div className="space-y-3">
                    {result.actions.map((item, i) => (
                        <div key={`or-${i}`} className="text-sm text-muted-foreground bg-background/50 p-3 rounded-md flex items-start gap-4">
                            <Checkbox 
                                id={`action-${i}`}
                                checked={selectedActions.includes(item)}
                                onCheckedChange={(checked) => handleActionToggle(item, !!checked)}
                                className="mt-1"
                            />
                            <div className='flex-1'>
                                <Label htmlFor={`action-${i}`} className="font-semibold text-foreground capitalize">{item.type.replace('_', ' ')} on {item.target}</Label>
                                <pre className="mt-1 text-xs whitespace-pre-wrap font-mono">{JSON.stringify(item.data || item.changes, null, 2)}</pre>
                                {item.reason && <p className="text-xs italic mt-2 border-t pt-2">AI Reason: "{item.reason}"</p>}
                                {item.confidence && <p className="text-xs mt-1">Confidence: {Math.round(item.confidence*100)}%</p>}
                            </div>
                        </div>
                    ))}
                </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No actionable suggestions found.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading || isSaving}>
            <X className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button onClick={handleApprove} disabled={isLoading || isSaving || selectedActions.length === 0}>
            {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Approve ({selectedActions.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
