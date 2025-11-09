'use client';

import { useState, useCallback } from 'react';
import { UploadCloud, LoaderCircle, FileText, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { processMediaFile } from '@/ai/flows/process-media-file-flow';
import { orchestrateText, type OrchestrateTextOutput } from '@/ai/flows/infoshard-text-flow';

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
    extracting: 'Extracting text from file...',
    orchestrating: 'Generating CRM actions...',
    done: 'Processing complete!',
    error: 'An error occurred.',
};

export function FileToCrmProcessor({ crmData, crmDataLoading }: FileToCrmProcessorProps) {
  const [processingState, setProcessingState] = useState<ProcessingState>('idle');
  const [result, setResult] = useState<OrchestrateTextOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const { toast } = useToast();

  const handleFile = useCallback(async (file: File) => {
    setProcessingState('uploading');
    setResult(null);
    setError(null);

    const supportedTypes = ['audio/', 'video/', 'application/pdf'];
    if (!supportedTypes.some(type => file.type.startsWith(type))) {
      toast({
        variant: 'destructive',
        title: 'Unsupported File Type',
        description: 'Please upload an audio, video, or PDF file.',
      });
      setProcessingState('idle');
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      const fileDataUri = reader.result as string;
      
      try {
        // Step 1: Extract text from the file
        setProcessingState('extracting');
        const { extractedText } = await processMediaFile({ fileDataUri });

        if (!extractedText) {
          throw new Error('AI could not extract any text from the file.');
        }

        // Step 2: Orchestrate text to generate CRM actions
        setProcessingState('orchestrating');
        const orchestrationResult = await orchestrateText({
          text: extractedText,
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
    };
    reader.onerror = () => {
        setError('Failed to read the file.');
        setProcessingState('error');
        toast({ variant: 'destructive', title: 'File Read Error' });
    };
  }, [toast, crmData]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    if (processingState !== 'idle') return;
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
        <CardDescription>Upload an audio, video, or PDF file to automatically extract insights and update your CRM.</CardDescription>
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
          <p className="text-xs text-muted-foreground">Audio, Video, or PDF files</p>
          <input
            id="file-upload"
            type="file"
            className="hidden"
            onChange={handleFileChange}
            disabled={isProcessing}
            accept="audio/*,video/*,application/pdf"
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
