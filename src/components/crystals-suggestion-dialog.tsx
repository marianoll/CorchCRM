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
import type { InfoshardTextOutput } from '@/ai/flows/infoshard-text-flow';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

type Infotope = InfoshardTextOutput['infotopes'][0];

interface CrystalsSuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  emailBody: string;
  emailSourceIdentifier: string;
  processFunction: () => Promise<InfoshardTextOutput | null>;
}

export function CrystalsSuggestionDialog({
  open,
  onOpenChange,
  emailBody,
  emailSourceIdentifier,
  processFunction,
}: CrystalsSuggestionDialogProps) {
  const [result, setResult] = useState<InfoshardTextOutput | null>(null);
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

    // Save each infotope as a "crystal"
    result.infotopes.forEach(infotope => {
        const crystalRef = doc(collection(firestore, 'crystals'));
        
        batch.set(crystalRef, {
            fact: `(${infotope.entityName}) ${infotope.fact}`,
            source: 'email',
            sourceIdentifier: emailSourceIdentifier,
            status: 'active',
            createdAt: new Date().toISOString(),
        });
    });

    // TODO: Process orchestrator commands in a real application
    // For now, we just log them. In a real app, this would trigger
    // other flows to create contacts, update deals, etc.

    try {
        await batch.commit();
        toast({
            title: 'Crystals Approved!',
            description: `${result.infotopes.length} facts have been saved.`
        });
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
  
  const parseDetails = (details: string | undefined) => {
    if (!details) return {};
    try {
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
                <h4 className="font-semibold text-sm mb-2">Infotopes (Crystals):</h4>
                {result.infotopes.length > 0 ? (
                  <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                    {result.infotopes.map((item, i) => (
                      <li key={`it-${i}`}>
                        ({item.entityName}
                        <span className="font-mono text-xs bg-background/50 px-1 py-0.5 rounded-sm mx-1">
                          {item.entityId || 'Not Found'}
                        </span>
                        , {item.fact})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No facts extracted.</p>
                )}
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-2">Orchestrate Commands:</h4>
                {result.orchestrators.length > 0 ? (
                 <div className="space-y-2">
                    {result.orchestrators.map((item, i) => (
                        <div key={`or-${i}`} className="text-sm text-muted-foreground bg-background/50 p-2 rounded-md">
                            <p className="font-semibold text-foreground">{item.command}</p>
                            <pre className="mt-1 text-xs whitespace-pre-wrap font-mono">{JSON.stringify(parseDetails(item.details), null, 2)}</pre>
                            {item.sourceText && <p className="text-xs italic mt-2 border-t pt-1">Source: "{item.sourceText}"</p>}
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
          <Button onClick={handleApprove} disabled={isLoading || isSaving || !result || result.infotopes.length === 0}>
            {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
            Approve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
