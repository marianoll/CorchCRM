'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { type Suggestion } from '@/lib/mock-data';
import { reviewAiSuggestions } from '@/ai/flows/review-ai-suggestions';
import { Check, X, LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SuggestionCardProps {
  suggestion: Suggestion;
}

export function SuggestionCard({ suggestion }: SuggestionCardProps) {
  const [isPending, startTransition] = useTransition();
  const [isGone, setIsGone] = useState(false);
  const { toast } = useToast();

  const handleAction = (approvalStatus: 'approved' | 'rejected') => {
    startTransition(async () => {
      try {
        await reviewAiSuggestions({
          suggestionId: suggestion.id,
          suggestionType: 'contact', // Simplified for demo
          suggestedUpdates: suggestion.raw,
          approvalStatus,
        });

        toast({
          title: `Suggestion ${approvalStatus}`,
          description: `The suggestion has been ${approvalStatus}.`,
        });

        setIsGone(true);

      } catch (error) {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Action Failed',
          description: 'Could not process your request.',
        });
      }
    });
  };

  if (isGone) {
    return null;
  }

  return (
    <Card className={cn("transition-all duration-300", isPending && "opacity-50 pointer-events-none")}>
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
            {suggestion.type}
        </CardTitle>
        <CardDescription>Source: {suggestion.source}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-mono bg-secondary p-3 rounded-md">{suggestion.details}</p>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => handleAction('rejected')} disabled={isPending}>
          <X className="mr-2 h-4 w-4" /> Reject
        </Button>
        <Button onClick={() => handleAction('approved')} disabled={isPending}>
          {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
          Approve
        </Button>
      </CardFooter>
    </Card>
  );
}
