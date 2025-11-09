
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { LoaderCircle, MessageCircle, Send, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { naturalLanguageSearchFlow, type NaturalLanguageSearchOutput } from '@/ai/flows/natural-language-search';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import ReactMarkdown from 'react-markdown';

type SearchChatbotProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: any[] | null;
  deals: any[] | null;
  companies: any[] | null;
};

export function SearchChatbot({ open, onOpenChange, contacts, deals, companies }: SearchChatbotProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<NaturalLanguageSearchOutput | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleSearch = () => {
    if (!query) {
      toast({
        variant: 'destructive',
        title: 'Query is empty',
        description: 'Please enter a search query.',
      });
      return;
    }

    setResult(null);
    startTransition(async () => {
      try {
        // Data from `useCollection` now has Dates instead of Timestamps.
        // We still need to serialize them before sending over the network.
        const serializableDeals = deals?.map(deal => {
            const newDeal = { ...deal };
            for (const key in newDeal) {
                if (newDeal[key] instanceof Date) {
                    newDeal[key] = newDeal[key].toISOString();
                }
            }
            return newDeal;
        });

        const res = await naturalLanguageSearchFlow({ 
            query,
            context: {
                contacts: contacts || [],
                deals: serializableDeals || [],
                companies: companies || [],
            }
        });
        setResult(res);
      } catch (error) {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Search Failed',
          description: 'There was a problem with your search.',
        });
      }
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setQuery('');
      setResult(null);
    }
    onOpenChange(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle />
            Natural Language Search
          </DialogTitle>
          <DialogDescription>
            Ask a question about your CRM data in plain English.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex w-full items-center space-x-2">
            <Input
              type="text"
              placeholder="e.g., 'deals over 50k for Acme Corp'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              disabled={isPending}
              className="text-base"
            />
            <Button onClick={handleSearch} disabled={isPending} size="icon">
              {isPending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              <span className="sr-only">Search</span>
            </Button>
          </div>
          <div className="min-h-[200px] max-h-[400px] overflow-y-auto">
            {isPending && (
              <div className="flex flex-col items-center justify-center rounded-lg p-12 text-center">
                <LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
                <span className="text-muted-foreground">Finding results...</span>
              </div>
            )}
            {result && (
                <Alert>
                    <Sparkles className="h-4 w-4" />
                    <AlertTitle>AI Interpretation</AlertTitle>
                    <AlertDescription className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{result.results}</ReactMarkdown>
                    </AlertDescription>
                </Alert>
            )}
          </div>
        </div>
        <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
