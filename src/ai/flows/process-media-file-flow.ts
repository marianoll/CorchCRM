'use server';
/**
 * @fileOverview A Genkit flow for extracting text from various media files (audio, video, PDF).
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

const ProcessMediaInputSchema = z.object({
  fileDataUri: z.string().describe("File data encoded as a data URI. Expected format: 'data:<mimetype>;base64,...'"),
});
export type ProcessMediaInput = z.infer<typeof ProcessMediaInputSchema>;


const ProcessMediaOutputSchema = z.object({
  extractedText: z.string().describe('The extracted text from the file.'),
});
export type ProcessMediaOutput = z.infer<typeof ProcessMediaOutputSchema>;


const processMediaPrompt = ai.definePrompt({
    name: 'processMediaFilePrompt',
    model: googleAI.model('gemini-2.0-flash-lite'),
    input: { schema: ProcessMediaInputSchema },
    prompt: `You are a data extraction specialist. Your task is to extract all relevant text from the provided file.
- For audio or video, transcribe the speech.
- For documents like PDFs, extract the text content.

Provide only the extracted text content. Do not add any commentary or summary.
    
File: {{media url=fileDataUri}}
    `,
});


const processMediaFileFlow = ai.defineFlow(
  {
    name: 'processMediaFileFlow',
    inputSchema: ProcessMediaInputSchema,
    outputSchema: ProcessMediaOutputSchema,
  },
  async (input) => {
    const mimeType = input.fileDataUri.substring(input.fileDataUri.indexOf(':') + 1, input.fileDataUri.indexOf(';'));

    // Guard against unsupported types
    if (mimeType.startsWith('image/')) {
        throw new Error('Image files are not supported for text extraction.');
    }
    
    const llmResponse = await processMediaPrompt(input);
    const extractedText = llmResponse.text;
    
    if (!extractedText) {
        throw new Error('Could not extract any text from the provided file.');
    }
    
    return { extractedText: extractedText.trim() };
  }
);


export async function processMediaFile(input: ProcessMediaInput): Promise<ProcessMediaOutput> {
  return processMediaFileFlow(input);
}
