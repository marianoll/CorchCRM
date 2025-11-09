'use client';

import { useState, useCallback } from 'react';
import { UploadCloud, LoaderCircle, FileText, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { orchestrateText, type OrchestrateTextOutput } from '@/ai/flows/infoshard-text-flow';
import { speechToText } from '@/ai/flows/speech-to-text-flow';
import { useUser } from '@/firebase/auth/use-user';
import { db } from '@/firebase/client';
import { collection, doc, setDoc } from 'firebase/firestore';


type CrmData = {
    contacts: { id: string; name: string }[];
    companies: { id: string; name: string }[];
    deals: { id: string; name: string }[];
};

interface FileToCrmProcessorProps {
    crmData: CrmData;
    crmDataLoading: boolean;
}

type ProcessingState = 'idle' | 'uploading' | 'extracting' | 'orchestrating' | 'done' | 'error';
const stateDescriptions: Record<ProcessingState, string> = {
    idle: 'Awaiting file upload.',
    uploading: 'Reading file...',
    extracting: 'Extracting text content...',
    orchestrating: 'Generating CRM actions from text...',
    done: 'Processing complete!',
    error: 'An error occurred.',
};

export function FileToCrmProcessor({ crmData, crmDataLoading }: FileToCrmProcessorProps) {
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [result, setResult] = useState<OrchestrateTextOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
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

  const handleFile = useCallback(async (file: File) => {
    setProcessingState('uploading');
    setResult(null);
    setError(null);

    const isAudioVideo = file.type.startsWith('audio/') || file.type.startsWith('video/');
    const isEml = file.name.endsWith('.eml') || file.type === 'message/rfc822';

    if (!isAudioVideo && !isEml) {
      toast({
        variant: 'destructive',
        title: 'Unsupported File Type',
        description: 'Please upload an audio, video, or .eml file.',
      });
      setProcessingState('idle');
      return;
    }

    try {
        let textContent = '';
        if (isAudioVideo) {
            setProcessingState('extracting');
            const reader = new FileReader();
            const dataUrlPromise = new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error('Failed to read file as Data URL.'));
                reader.readAsDataURL(file);
            });
            const audioDataUri = await dataUrlPromise;
            const { transcript } = await speechToText({ audioDataUri });
            textContent = transcript;
            stateDescriptions.extracting = 'Transcribing audio to text...';
        } else if (isEml) {
            setProcessingState('extracting');
            const reader = new FileReader();
             const textPromise = new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error('Failed to read file as text.'));
                reader.readAsText(file);
            });
            textContent = await textPromise;
            stateDescriptions.extracting = 'Extracting text from email file...';
        }

        if (!textContent) {
          throw new Error('AI could not extract any text from the file.');
        }

        // Save the extracted text before orchestration
        await saveUpload(textContent, 'file', file.name);

        // Step 2: Orchestrate text to generate CRM actions
        setProcessingState('orchestrating');
        const orchestrationResult = await orchestrateText({
          text: textContent,
          contacts: crmData.contacts,
          companies: crmData.companies,
          deals: crmData.deals,
        });

        setResult(orchestrationResult);
        setProcessingState('done');
        toast({ title: 'Processing Complete!', description: 'Review the suggested actions below.' });

      } catch (err: any) {
        console.error(err);
        setError(err.message || 'An unknown error occurred during processing.');
        setProcessingState('error');
        toast({
          variant: 'destructive',
          title: 'Processing Failed',
          description: err.message || 'There was a problem with the AI.',
        });
      }
  }, [toast, crmData, saveUpload]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    if (processingState !== 'idle' && processingState !== 'done' && processingState !== 'error') return;
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  }, [handleFile, processingState]);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const isProcessing = processingState !== 'idle' && processingState !== 'done' && processingState !== 'error';

  return (
    <Card>
      <CardHeader>
        <CardTitle>File-to-CRM</CardTitle>
        <CardDescription>Upload an audio, video, or .eml file to automatically extract insights and update your CRM.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'relative flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg transition-colors',
            isDragOver ? 'border-primary bg-primary/10' : 'border-border',
            isProcessing && 'cursor-not-allowed opacity-50'
          )}
        >
          <UploadCloud className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            <label htmlFor="file-upload" className="font-semibold text-primary cursor-pointer hover:underline">
              Click to upload
            </label>
            {' '}or drag and drop a file
          </p>
          <p className="text-xs text-muted-foreground">Audio, Video, or .eml files</p>
          <input
            id="file-upload"
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={isProcessing}
            accept="audio/*,video/*,.eml,message/rfc822"
          />
        </div>

        {processingState !== 'idle' && (
             <div className="space-y-4 rounded-lg border bg-secondary/50 p-4">
                <div className="flex items-center gap-3">
                    {isProcessing ? <LoaderCircle className="h-5 w-5 animate-spin"/> :
                     processingState === 'done' ? <CheckCircle className="h-5 w-5 text-green-500" /> :
                     <XCircle className="h-5 w-5 text-destructive" />
                    }
                    <div className="flex-1">
                        <p className="text-sm font-medium">{stateDescriptions[processingState]}</p>
                    </div>
                </div>

                {result && result.actions.length > 0 && (
                 <div className="space-y-2 pt-4 border-t">
                    <h4 className="font-semibold text-sm">Suggested Actions:</h4>
                    {result.actions.map((item, i) => (
                        <div key={`or-${i}`} className="text-sm text-muted-foreground bg-background/50 p-2 rounded-md">
                            <p className="font-semibold text-foreground">{item.type} on {item.target}</p>
                            <pre className="mt-1 text-xs whitespace-pre-wrap font-mono">{JSON.stringify(item.data || item.changes, null, 2)}</pre>
                            {item.reason && <p className="text-xs italic mt-2 border-t pt-1">Reason: "{item.reason}"</p>}
                        </div>
                    ))}
                </div>
              )}
               {result && result.actions.length === 0 && processingState === 'done' && (
                 <p className="text-sm text-muted-foreground italic pt-4 border-t">No specific CRM actions were suggested from this file.</p>
               )}
            </div>
        )}

      </CardContent>
    </Card>
  );
}

    