
'use client';

import { useState, useTransition, useRef } from 'react';
import { Mic, Square, LoaderCircle, Sparkles, Gem, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { voiceToCRM, type VoiceToCRMOutput } from '@/ai/flows/voice-to-crm';
import { crystallizeText, type CrystallizeTextOutput } from '@/ai/flows/crystallize-text';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { useFirestore, useUser } from '@/firebase';
import { addDoc, collection } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


type RecordingState = 'idle' | 'recording' | 'loading' | 'success';

export function VoiceRecorder() {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [transcriptionResult, setTranscriptionResult] = useState<VoiceToCRMOutput | null>(null);
  const [crystalsResult, setCrystalsResult] = useState<CrystallizeTextOutput | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

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
      setTranscriptionResult(null);
      setCrystalsResult(null);
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
        // 1. Get transcription
        const transcriptionRes = await voiceToCRM({ audioDataUri });
        setTranscriptionResult(transcriptionRes);

        // 2. Use transcription to get crystals, passing it as an object
        const crystalsRes = await crystallizeText({ content: transcriptionRes.transcription });
        setCrystalsResult(crystalsRes);

        setRecordingState('success');
        toast({
          title: 'Voice Note Processed',
          description: 'Your voice note has been transcribed and crystallized.',
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

  const handleSaveCrystals = async () => {
    if (!crystalsResult || !crystalsResult.infotopes || !firestore || !user) return;

    setIsSaving(true);
    const factsToSave = crystalsResult.infotopes;
     if (factsToSave.length === 0) {
        toast({ title: "No facts to save." });
        setIsSaving(false);
        return;
    }

    const crystalsCollection = collection(firestore, 'users', user.uid, 'infotopes');

    const savePromises = factsToSave.map(fact => {
        const crystalData = {
            fact_text: fact.text,
            entity_key: fact.entity,
            source: { kind: 'voice' },
            status: 'open',
            observed_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
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
        setTranscriptionResult(null);
        setCrystalsResult(null);
        return;
    }
    handleRecord();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Voice-to-CRM</CardTitle>
        <CardDescription>Record a voice note. AI will transcribe, crystallize, and suggest CRM updates.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recordingState === 'success' && transcriptionResult && (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertTitle>Transcription</AlertTitle>
            <AlertDescription className="space-y-2">
                <p className="text-sm text-muted-foreground">{transcriptionResult.transcription}</p>
            </AlertDescription>
          </Alert>
        )}
        {crystalsResult && (crystalsResult.infotopes.length > 0 || crystalsResult.orchestrators.length > 0) && (
          <Alert>
            <Gem className="h-4 w-4" />
            <AlertTitle className='flex justify-between items-center'>
                <span>Generated Crystals</span>
                 <Button size="sm" onClick={handleSaveCrystals} disabled={isSaving || crystalsResult.infotopes.length === 0}>
                    {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Save Facts
                </Button>
            </AlertTitle>
            <AlertDescription className="space-y-2 mt-2">
                 <div className='font-mono text-xs bg-slate-100 dark:bg-slate-800 p-2 rounded'>
                    <pre>{JSON.stringify(crystalsResult, null, 2)}</pre>
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
