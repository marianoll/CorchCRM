'use client';

import { useState, useTransition } from 'react';
import { Mic, Square, LoaderCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { voiceToCRM, type VoiceToCRMOutput } from '@/ai/flows/voice-to-crm';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

type RecordingState = 'idle' | 'recording' | 'loading' | 'success';

export function VoiceRecorder() {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [result, setResult] = useState<VoiceToCRMOutput | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleRecord = () => {
    if (recordingState === 'idle') {
      setRecordingState('recording');
      setResult(null);
    } else if (recordingState === 'recording') {
      setRecordingState('loading');
      startTransition(async () => {
        try {
            // This is a placeholder for a real audio data URI.
            const mockAudioDataUri = "data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYECGFOAZwEAAAAAAAAAAAAAAA...";
            const res = await voiceToCRM({ audioDataUri: mockAudioDataUri });
            setResult(res);
            setRecordingState('success');
            toast({
                title: 'Voice Note Processed',
                description: 'Your voice note has been transcribed and analyzed.',
            });
        } catch (error) {
            console.error(error);
            toast({
                variant: 'destructive',
                title: 'Error Processing Voice Note',
                description: 'There was a problem analyzing your voice note.',
            });
            setRecordingState('idle');
        }
      });
    }
  };

  const buttonText = {
    idle: 'Start Recording',
    recording: 'Stop Recording',
    loading: 'Processing...',
  };

  const buttonIcon = {
    idle: <Mic className="mr-2 h-4 w-4" />,
    recording: <Square className="mr-2 h-4 w-4 animate-pulse fill-current text-red-500" />,
    loading: <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice-to-CRM</CardTitle>
        <CardDescription>Record a voice note. AI will transcribe and update CRM records automatically.</CardDescription>
      </CardHeader>
      <CardContent>
        {recordingState === 'success' && result && (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>AI Analysis Complete</AlertTitle>
            <AlertDescription className="space-y-2">
              <div>
                <h3 className="font-semibold">Transcription:</h3>
                <p className="text-sm text-muted-foreground">{result.transcription}</p>
              </div>
              <div>
                <h3 className="font-semibold">Suggested CRM Updates:</h3>
                <p className="text-sm text-muted-foreground">{result.crmUpdates}</p>
              </div>
            </AlertDescription>
          </Alert>
        )}
         {(recordingState === 'idle' || recordingState === 'recording') && (
            <div className="flex items-center justify-center rounded-lg border-2 border-dashed p-12 text-center text-muted-foreground">
                {recordingState === 'idle' ? 'Click "Start Recording" to begin' : 'Recording... Click to stop.'}
            </div>
         )}
         {recordingState === 'loading' && (
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center text-muted-foreground">
                <LoaderCircle className="h-8 w-8 animate-spin mb-2" />
                <span>Analyzing audio...</span>
            </div>
         )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleRecord} disabled={isPending} className="w-full">
          {buttonIcon[recordingState as Exclude<RecordingState, 'success'>]}
          {buttonText[recordingState as Exclude<RecordingState, 'success'>]}
        </Button>
      </CardFooter>
    </Card>
  );
}
