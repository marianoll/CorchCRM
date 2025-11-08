'use client';

import { useState, useTransition, useRef } from 'react';
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          processAudio(base64Audio);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setRecordingState('recording');
      setResult(null);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      toast({
        variant: 'destructive',
        title: 'Microphone access denied',
        description: 'Please allow microphone access in your browser settings to use this feature.',
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.stop();
      setRecordingState('loading');
    }
  };

  const processAudio = (audioDataUri: string) => {
    startTransition(async () => {
      try {
        const res = await voiceToCRM({ audioDataUri });
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
  };

  const handleRecord = () => {
    if (recordingState === 'idle') {
      startRecording();
    } else if (recordingState === 'recording') {
      stopRecording();
    }
  };

  const buttonText = {
    idle: 'Start Recording',
    recording: 'Stop Recording',
    loading: 'Processing...',
    success: 'Start New Recording',
  };

  const buttonIcon = {
    idle: <Mic className="mr-2 h-4 w-4" />,
    recording: <Square className="mr-2 h-4 w-4 animate-pulse fill-current text-red-500" />,
    loading: <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />,
    success: <Mic className="mr-2 h-4 w-4" />,
  };
  
  const getButtonAction = () => {
    if (recordingState === 'success') {
        setRecordingState('idle');
        setResult(null);
        return;
    }
    handleRecord();
  }

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
        <Button onClick={getButtonAction} disabled={isPending} className="w-full">
          {buttonIcon[recordingState]}
          {buttonText[recordingState]}
        </Button>
      </CardFooter>
    </Card>
  );
}
