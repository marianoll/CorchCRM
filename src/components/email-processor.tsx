'use client';

import { useState, useTransition } from 'react';
import { Mail, LoaderCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { emailToCRM, type EmailToCRMOutput } from '@/ai/flows/email-to-crm';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

const sampleEmail = `Hi Team,

Just had a great call with Javier Gomez from Tech Solutions. He's very interested in our cloud migration package. His number is +1-345-678-901.

He asked for a detailed proposal by end of day Friday. Can someone please prepare and send it?

Let's also schedule a follow-up call for next week to discuss details.

Best,
Admin`;

export function EmailProcessor() {
  const [emailContent, setEmailContent] = useState(sampleEmail);
  const [result, setResult] = useState<EmailToCRMOutput | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleProcessEmail = () => {
    if (!emailContent) {
      toast({
        variant: 'destructive',
        title: 'Email content is empty',
        description: 'Please paste an email to process.',
      });
      return;
    }

    startTransition(async () => {
      try {
        const res = await emailToCRM({ emailContent });
        setResult(res);
        toast({
          title: 'Email Processed',
          description: 'AI has extracted information from the email.',
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email-to-CRM</CardTitle>
        <CardDescription>Paste an email below. AI will create contacts, tasks, and summarize the content.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Paste email content here..."
          value={emailContent}
          onChange={(e) => setEmailContent(e.target.value)}
          rows={8}
          disabled={isPending}
        />
        {result && (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>AI Analysis Complete</AlertTitle>
            <AlertDescription className="space-y-2">
              <div>
                <h3 className="font-semibold">Summary:</h3>
                <p className="text-sm text-muted-foreground">{result.summary}</p>
              </div>
              <div>
                <h3 className="font-semibold">Extracted Contacts:</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {result.contacts.map((contact, i) => <li key={i}>{contact.name} ({contact.email})</li>)}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold">Action Items:</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground">
                    {result.actionItems.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
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
          Process Email
        </Button>
      </CardFooter>
    </Card>
  );
}
