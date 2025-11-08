'use client';

import { useState, useTransition } from 'react';
import { Mail, LoaderCircle, Sparkles, Gem, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { emailToCRM, type EmailToCRMOutput } from '@/ai/flows/email-to-crm';
import { crystallizeText, type CrystallizeTextOutput } from '@/ai/flows/crystallize-text';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useFirestore } from '@/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const sampleEmail = `Hi Team,

Just had a great call with Javier Gomez from Tech Solutions. He's very interested in our cloud migration package. His number is +1-345-678-901.

He asked for a detailed proposal by end of day Friday. Can someone please prepare and send it?

Let's also schedule a follow-up call for next week to discuss details.

Best,
Admin`;

export function EmailProcessor() {
  const [emailContent, setEmailContent] = useState(sampleEmail);
  const [analysisResult, setAnalysisResult] = useState<EmailToCRMOutput | null>(null);
  const [crystalsResult, setCrystalsResult] = useState<CrystallizeTextOutput | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();

  const handleProcessEmail = () => {
    if (!emailContent) {
      toast({
        variant: 'destructive',
        title: 'Email content is empty',
        description: 'Please paste an email to process.',
      });
      return;
    }
    
    setAnalysisResult(null);
    setCrystalsResult(null);

    startTransition(async () => {
      try {
        const [analysisRes, crystalsRes] = await Promise.all([
            emailToCRM({ emailContent }),
            crystallizeText({ content: emailContent })
        ]);

        setAnalysisResult(analysisRes);
        setCrystalsResult(crystalsRes);
        
        toast({
          title: 'Email Processed',
          description: 'AI has extracted information and generated crystals.',
        });
      } catch (error) {
        console.error(error);
        toast({
          variant: 'destructive',
          title: 'Error Processing Email',
          description: 'There was a problem analyzing the email.',
        });
      }
    });
  };

  const handleSaveCrystals = async () => {
    if (!crystalsResult || !crystalsResult.results || !firestore) return;

    setIsSaving(true);
    const factsToSave = crystalsResult.results.filter(c => c.type === 'Fact');
    if (factsToSave.length === 0) {
        toast({ title: "No facts to save." });
        setIsSaving(false);
        return;
    }

    const crystalsCollection = collection(firestore, 'crystals');

    const savePromises = factsToSave.map(fact => {
        const crystalData = {
            fact: fact.text,
            source: 'email',
            sourceIdentifier: 'Manually Processed Email', // Simplified for now
            status: 'active',
            createdAt: new Date().toISOString(),
        };
        return addDoc(crystalsCollection, crystalData)
            .catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                  path: crystalsCollection.path,
                  operation: 'create',
                  requestResourceData: crystalData,
                });
                errorEmitter.emit('permission-error', permissionError);
                throw permissionError; // throw to stop Promise.all
            });
    });

    try {
        await Promise.all(savePromises);
        toast({
            title: 'Facts Saved',
            description: `${factsToSave.length} facts have been saved to the log.`
        });
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Error Saving Facts',
            description: 'Could not save facts to the database.'
        })
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email-to-CRM</CardTitle>
        <CardDescription>Paste an email below. AI will create contacts, tasks, summarize, and crystallize the content.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Paste email content here..."
          value={emailContent}
          onChange={(e) => setEmailContent(e.target.value)}
          rows={8}
          disabled={isPending}
        />
        {analysisResult && (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>AI Analysis Complete</AlertTitle>
            <AlertDescription className="space-y-2">
              <div>
                <h3 className="font-semibold">Summary:</h3>
                <p className="text-sm text-muted-foreground">{analysisResult.summary}</p>
              </div>
              <div>
                <h3 className="font-semibold">Extracted Contacts:</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {analysisResult.contacts.map((contact, i) => <li key={i}>{contact.name} ({contact.email})</li>)}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold">Action Items:</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {analysisResult.actionItems.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}
         {crystalsResult && crystalsResult.results && crystalsResult.results.length > 0 && (
          <Alert>
            <Gem className="h-4 w-4" />
            <AlertTitle className='flex justify-between items-center'>
                <span>Generated Crystals</span>
                 <Button size="sm" onClick={handleSaveCrystals} disabled={isSaving}>
                    {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Save Facts
                </Button>
            </AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
                <div className='font-mono text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded'>
                    <pre>{JSON.stringify(crystalsResult.results, null, 2)}</pre>
                </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleProcessEmail} disabled={isPending} className="w-full">
          {isPending ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Mail className="mr-2 h-4 w-4" />
          )}
          Process & Crystallize Email
        </Button>
      </CardFooter>
    </Card>
  );
}
