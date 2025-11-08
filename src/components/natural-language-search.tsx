'use client';

import { useState, useTransition } from 'react';
import { Search as SearchIcon, LoaderCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { naturalLanguageSearch, type NaturalLanguageSearchOutput } from '@/ai/flows/natural-language-search';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

export function NaturalLanguageSearch() {
  const [query, setQuery] = useState('deals with no response in 10 days');
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
        const res = await naturalLanguageSearch({ query });
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

  return (
    <div className="space-y-6">
      <div className="flex w-full items-center space-x-2">
        <Input
          type="text"
          placeholder="e.g., 'deals closed this month'"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          disabled={isPending}
          className="text-base"
        />
        <Button onClick={handleSearch} disabled={isPending}>
          {isPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <SearchIcon className="h-4 w-4" />
          )}
          <span className="sr-only sm:not-sr-only sm:ml-2">Search</span>
        </Button>
      </div>
      {isPending && (
         <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
            <LoaderCircle className="h-8 w-8 animate-spin mb-2" />
            <span>Finding results...</span>
        </div>
      )}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert>
                <Sparkles className="h-4 w-4" />
                <AlertTitle>AI Interpretation</AlertTitle>
                <AlertDescription className="font-mono text-sm bg-background p-3 -m-3 mt-2 rounded-lg">
                    {result.results}
                </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
