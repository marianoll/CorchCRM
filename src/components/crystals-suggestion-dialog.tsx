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
import { LoaderCircle, Check, X, Gem } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, writeBatch, Timestamp, doc } from 'firebase/firestore';
import type { OrchestrateTextOutput } from '@/ai/flows/infoshard-text-flow';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type Action = OrchestrateTextOutput['actions'][0];

interface CrystalsSuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailBody: string;
  emailSourceIdentifier: string;
  processFunction: () => Promise<OrchestrateTextOutput | null>;
}

export function CrystalsSuggestionDialog({
  open,
  onOpenChange,
  emailBody,
  emailSourceIdentifier,
  processFunction,
}: CrystalsSuggestionDialogProps) {
  const [result, setResult] = useState<OrchestrateTextOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const fetchData = useCallback(() => {
    if (open) {
      setResult(null);
      setIsLoading(true);
      processFunction()
        .then(res => {
            setResult(res);
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

  const handleApprove = async () => {
    if (!result || !firestore || !user) return;

    setIsSaving(true);
    const batch = writeBatch(firestore);

    // Filter for actions that are suggestions or create new entities that can be crystallized.
    const crystalsToSave = result.actions.filter(action => 
        action.type === 'create_entity' || 
        action.type === 'suggest' || 
        action.type === 'create_task'
    );


    crystalsToSave.forEach(action => {
        const crystalRef = doc(collection(firestore, 'crystals'));
        const fact = action.reason || `${action.type} for ${action.target}`;
        
        batch.set(crystalRef, {
            fact: fact,
            source: 'email',
            sourceIdentifier: emailSourceIdentifier,
            status: 'active',
            createdAt: new Date().toISOString(),
        });
    });

    try {
        if (crystalsToSave.length > 0) {
            await batch.commit();
            toast({
                title: 'Crystals Approved!',
                description: `${crystalsToSave.length} facts have been saved.`
            });
        } else {
             toast({
                title: 'No Crystals to Save',
                description: `No new facts were extracted this time.`
            });
        }
        onOpenChange(false);
    } catch (error) {
         if (error instanceof FirestorePermissionError) {
             errorEmitter.emit('permission-error', error);
        } else {
             toast({
                variant: 'destructive',
                title: 'Save Error',
                description: 'Could not save the approved crystals.',
            });
        }
    } finally {
        setIsSaving(false);
    }
  };
  
  const parseDetails = (details: Record<string, any> | undefined) => {
    if (!details) return {};
    try {
        // If details is already an object, just return it
        if (typeof details === 'object') return details;
        return JSON.parse(details);
    } catch (e) {
        return { raw: details };
    }
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gem className="text-primary" />
            Crystal Suggestions
          </DialogTitle>
          <DialogDescription>
            Review the facts and commands extracted by the AI from the email.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {isLoading && (
            <div className="flex flex-col items-center justify-center rounded-lg p-12 text-center">
              <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
              <span className="text-muted-foreground">Extracting crystals...</span>
            </div>
          )}

          {result && (
            <div className="space-y-4 rounded-lg border bg-secondary/50 p-4">
              <div>
                <h4 className="font-semibold text-sm mb-2">Orchestration Actions:</h4>
                {result.actions.length > 0 ? (
                 <div className="space-y-2">
                    {result.actions.map((item, i) => (
                        <div key={`or-${i}`} className="text-sm text-muted-foreground bg-background/50 p-2 rounded-md">
                            <p className="font-semibold text-foreground">{item.type} on {item.target}</p>
                            <pre className="mt-1 text-xs whitespace-pre-wrap font-mono">{JSON.stringify(item.data || item.changes, null, 2)}</pre>
                            {item.reason && <p className="text-xs italic mt-2 border-t pt-1">Reason: "{item.reason}"</p>}
                        </div>
                    ))}
                </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No commands generated.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading || isSaving}>
            <X className="mr-2 h-4 w-4" /> Reject
          </Button>
          <Button onClick={handleApprove} disabled={isLoading || isSaving || !result || result.actions.length === 0}>
            {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Approve & Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
