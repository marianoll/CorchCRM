'use client';

import { useState, useTransition } from 'react';
import { LoaderCircle, Gem } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { infoshardText, type InfoshardTextOutput } from '@/ai/flows/infoshard-text-flow';

const sampleText = `Just had a great call with Javier Gomez from Tech Solutions. He's very interested in our cloud migration package and mentioned their budget is around $50k. He asked for a detailed proposal by end of day Friday.`;

type CrmData = {
    contacts: { id: string; name: string }[];
    companies: { id: string; name: string }[];
    deals: { id: string; name: string }[];
};

interface InfoshardProcessorProps {
    crmData: CrmData;
    crmDataLoading: boolean;
}


export function InfoshardProcessor({ crmData, crmDataLoading }: InfoshardProcessorProps) {
  const [inputText, setInputText] = useState(sampleText);
  const [result, setResult] = useState<InfoshardTextOutput | null>(null);
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
      try {
        const res = await infoshardText({ 
            text: inputText,
            contacts: crmData.contacts,
            companies: crmData.companies,
            deals: crmData.deals,
        });
        setResult(res);
      } catch (error: any) {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Processing Failed',
          description: error.message || 'There was a problem with the AI.',
        });
      }
    });
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
    <Card>
      <CardHeader>
        <CardTitle>Infoshard Processor</CardTitle>
        <CardDescription>Enter any text (notes, email snippets, thoughts) to create structured infotopes and orchestrator commands.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Enter text here..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          rows={8}
          disabled={isPending || crmDataLoading}
        />
        {isPending && (
            <div className="flex items-center justify-center p-8">
                <LoaderCircle className="mr-2 h-6 w-6 animate-spin" />
                <span>Processing...</span>
            </div>
        )}
        {result && (
          <div className="space-y-4 rounded-lg border bg-secondary/50 p-4">
            <div>
              <h4 className="font-semibold text-sm mb-2">Infotopes:</h4>
              {result.infotopes.length > 0 ? (
                <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                  {result.infotopes.map((item, i) => (
                    <li key={`it-${i}`}>
                        ({item.entityName}
                        <span className="font-mono text-xs bg-background/50 px-1 py-0.5 rounded-sm mx-1">
                            {item.entityId}
                        </span>, {item.fact})
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground italic">No infotopes extracted.</p>
              )}
            </div>
            <div>
              <h4 className="font-semibold text-sm mb-2">Orchestrate:</h4>
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
                <p className="text-sm text-muted-foreground italic">No orchestrator commands generated.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleProcess} disabled={isPending || crmDataLoading} className="w-full">
          {(isPending || crmDataLoading) ? (
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
