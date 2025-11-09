'use client';

import { useState, useTransition } from 'react';
import { LoaderCircle, Sparkles, Gem } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

const sampleText = `Just had a great call with Javier Gomez from Tech Solutions. He's very interested in our cloud migration package and mentioned their budget is around $50k. He asked for a detailed proposal by end of day Friday.`;

export function InfoshardProcessor() {
  const [inputText, setInputText] = useState(sampleText);
  const [result, setResult] = useState<any | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleProcess = () => {
    if (!inputText) {
      toast({
        variant: 'destructive',
        title: 'Input text is empty',
        description: 'Please enter some text to shard.',
      });
      return;
    }
    
    setResult(null);

    startTransition(async () => {
        toast({
          variant: 'destructive',
          title: 'Feature Not Available',
          description: 'AI functionality is currently disabled.',
        });
    });
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>Infoshard Processor</CardTitle>
        <CardDescription>Enter any text (notes, email snippets, thoughts) to create a structured Infoshard.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Enter text here..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          rows={8}
          disabled={isPending}
        />
        {result && (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>Generated Infoshard</AlertTitle>
            <AlertDescription className="space-y-2">
                <div className='font-mono text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded'>
                    <pre>{JSON.stringify(result.shard, null, 2)}</pre>
                </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleProcess} disabled={isPending} className="w-full">
          {isPending ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Gem className="mr-2 h-4 w-4" />
          )}
          Create Infoshard
        </Button>
      </CardFooter>
    </Card>
  );
}
