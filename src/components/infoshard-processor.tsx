'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { LoaderCircle, Gem, Mic, Square, FileAudio, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { orchestrateText, type OrchestrateTextOutput } from '@/ai/flows/infoshard-text-flow';
import { speechToText } from '@/ai/flows/speech-to-text-flow';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase/auth/use-user';
import { db } from '@/firebase/client';
import { collection, doc, setDoc } from 'firebase/firestore';

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
  const [result, setResult] = useState<OrchestrateTextOutput | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [sampleAudioUsed, setSampleAudioUsed] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { user } = useUser();
  const { toast } = useToast();

  const saveUpload = async (content: string, source: 'note' | 'file', fileName?: string) => {
      if (!db || !user) return;
      const uploadRef = doc(collection(db, 'users', user.uid, 'uploads'));
      const uploadData = {
          id: uploadRef.id,
          createdAt: new Date().toISOString(),
          source,
          content,
          fileName: fileName || null,
      };
      await setDoc(uploadRef, uploadData);
  }

  const handleProcess = async (textToProcess: string) => {
    if (!textToProcess) {
      toast({
        variant: 'destructive',
        title: 'Input text is empty',
        description: 'Please enter some text to shard.',
      });
      return;
    }
    
    setIsProcessing(true);
    setResult(null);

    try {
      await saveUpload(textToProcess, 'note');

      const res = await orchestrateText({ 
          text: textToProcess,
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
    } finally {
        if (!sampleAudioUsed) {
            setIsProcessing(false);
        }
    }
  };

  const handleStartRecording = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = reader.result as string;
            setIsProcessing(true);
            try {
              const { transcript } = await speechToText({ audioDataUri: base64Audio });
              setInputText(transcript);
              // Automatically trigger processing after transcription
              await handleProcess(transcript);
            } catch (error: any) {
              toast({ variant: 'destructive', title: 'Transcription Failed', description: error.message });
              setIsProcessing(false);
            }
          };
          // Stop all tracks on the stream to release the microphone
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);
      } catch (err) {
        toast({ variant: 'destructive', title: 'Microphone Error', description: 'Could not access the microphone.' });
      }
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleProcessSampleAudio = async () => {
      setIsProcessing(true);
      setSampleAudioUsed(true);
      setResult(null);
      setInputText('');
      toast({ title: 'Processing Sample Audio...', description: 'Fetching, transcribing, and analyzing the sample.' });

      try {
          // 1. Fetch the sample audio file from the public directory
          const response = await fetch('/audio_sample.mp3');
          if (!response.ok) {
              throw new Error('Sample audio file not found.');
          }
          const audioBlob = await response.blob();

          // 2. Convert to Base64 Data URI
          const reader = new FileReader();
          const dataUrlPromise = new Promise<string>((resolve, reject) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(audioBlob);
          });
          const audioDataUri = await dataUrlPromise;

          // 3. Transcribe using speechToText flow
          const { transcript } = await speechToText({ audioDataUri });
          setInputText(transcript);

          // 4. Process the transcript to get CRM actions
          await handleProcess(transcript);

      } catch (error: any) {
          console.error('Error processing sample audio:', error);
          toast({
              variant: 'destructive',
              title: 'Sample Processing Failed',
              description: error.message || 'Could not process the sample audio file.',
          });
          // Do not set isProcessing to false to keep the loader infinite
      }
  };
  
  const parseDetails = (details: Record<string, any> | undefined) => {
    if (!details) return {};
    try {
        if (typeof details === 'object') return details;
        return JSON.parse(details);
    } catch (e) {
        return { raw: details };
    }
  }


  return (
    <Card>
      <CardHeader>
        <CardTitle>Note-to-CRM</CardTitle>
        <CardDescription>Enter any text or record a voice note to generate structured CRM actions.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="Enter text here..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          rows={8}
          disabled={isProcessing || crmDataLoading || isRecording}
        />
        {(isProcessing && !isRecording) && (
            <div className="flex items-center justify-center p-8">
                <LoaderCircle className="mr-2 h-6 w-6 animate-spin" />
                <span>Processing...</span>
            </div>
        )}
        {result && (
          <div className="space-y-4 rounded-lg border bg-secondary/50 p-4">
            <div>
              <h4 className="font-semibold text-sm mb-2">Orchestrator Actions:</h4>
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
                <p className="text-sm text-muted-foreground italic">No orchestrator actions generated.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="grid grid-cols-1 md:grid-cols-3 gap-2">
         <Button onClick={() => handleProcess(inputText)} disabled={isProcessing || crmDataLoading || isRecording}>
          {isProcessing && !sampleAudioUsed ? (
            <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Gem className="mr-2 h-4 w-4" />
          )}
          Generate Actions
        </Button>
        <Button 
            onClick={isRecording ? handleStopRecording : handleStartRecording} 
            disabled={isProcessing || crmDataLoading}
            variant="outline"
            className={cn(isRecording && "bg-red-500/10 text-red-500 border-red-500/50 hover:bg-red-500/20 hover:text-red-500")}
        >
          {isRecording ? (
              <>
                <Square className="mr-2 h-4 w-4" />
                Stop Recording
              </>
          ) : (
              <>
                <Mic className="mr-2 h-4 w-4" />
                Record Voice Note
              </>
          )}
        </Button>
        <Button onClick={handleProcessSampleAudio} disabled={isProcessing || crmDataLoading || isRecording} variant="secondary">
            {sampleAudioUsed ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Sparkles className="mr-2 h-4 w-4" />
            )}
            Use Sample Audio
        </Button>
      </CardFooter>
    </Card>
  );
}
