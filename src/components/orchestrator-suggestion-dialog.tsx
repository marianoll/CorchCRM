
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
import { Table, TableBody, TableCell, TableHeader, TableHead, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { format } from 'date-fns';

interface OrchestratorSuggestionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: any; // Keeping it simple for now
  processFunction: () => Promise<OrchestratorOutput | null>;
}

export function OrchestratorSuggestionDialog({
  open,
  onOpenChange,
  email,
  processFunction,
}: OrchestratorSuggestionDialogProps) {
  const [result, setResult] = useState<OrchestratorOutput | null>(null);
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
  
  const handleApprove = async (action: Action) => {
    if (!firestore || !user) {
        toast({ title: 'Error', description: 'User or database not available.' });
        return;
    }
    
    setIsSaving(true);
    const batch = writeBatch(firestore);

    const logRef = doc(collection(firestore, 'audit_logs'));
    batch.set(logRef, {
        ts: new Date().toISOString(),
        actor_type: 'system_ai',
        actor_id: user.uid,
        action: action.type,
        entity_type: action.target,
        entity_id: action.id || 'new',
        table: action.target,
        source: 'email-orchestrator',
        after_snapshot: action.data || action.changes
    });
    
    try {
        await batch.commit();
        toast({
            title: 'Action Approved!',
            description: `Action "${action.type}" has been logged.`
        });
        // Remove action from list optimistically
        setResult(prev => prev ? ({ ...prev, actions: prev.actions.filter(a => a !== action) }) : null);
    } catch (error) {
        if (error instanceof FirestorePermissionError) {
             errorEmitter.emit('permission-error', error);
        } else {
             toast({
                variant: 'destructive',
                title: 'Approval Error',
                description: 'Could not save the action. Please try again.',
            });
        }
    } finally {
        setIsSaving(false);
    }
  }

  const handleReject = (action: Action) => {
    setResult(prev => prev ? ({ ...prev, actions: prev.actions.filter(a => a !== action) }) : null);
    toast({ title: 'Action Rejected', variant: 'default' });
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="text-primary" />
            Orchestrator Suggestions
          </DialogTitle>
          <DialogDescription>
            Review and approve the actions suggested by the AI based on the email from{' '}
            <span className="font-medium text-foreground">{email.from_email}</span>{' '}
            about <span className="font-medium text-foreground">"{email.subject}"</span>.
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
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Acción</TableHead>
                        <TableHead>Categoría</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Aprobar/Rechazar</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {result.actions.length === 0 && !isLoading && (
                        <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">No actionable suggestions found.</TableCell>
                        </TableRow>
                    )}
                    {result.actions.map((action, i) => (
                        <TableRow key={i}>
                            <TableCell>
                                <div className="font-medium">{action.reason || 'N/A'}</div>
                                {(action.data || action.changes) && (
                                    <pre className="mt-1 text-xs whitespace-pre-wrap font-mono bg-muted p-2 rounded-md">{JSON.stringify(action.data || action.changes, null, 2)}</pre>
                                )}
                            </TableCell>
                            <TableCell><Badge variant="outline">{action.type}</Badge></TableCell>
                            <TableCell>{action.date ? format(new Date(action.date), 'PP') : 'Now'}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex gap-2 justify-end">
                                    <Button size="sm" variant="outline" onClick={() => handleReject(action)} disabled={isSaving}>
                                        <X className="h-4 w-4 mr-1" />
                                        Rechazar
                                    </Button>
                                    <Button size="sm" onClick={() => handleApprove(action)} disabled={isSaving}>
                                        {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4 mr-1" />}
                                        Aprobar
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
          )}
        </div>

        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading || isSaving}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
