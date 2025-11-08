
'use server';

/**
 * @fileOverview An AI agent for transcribing voice notes.
 *
 * - voiceToCRM - A function that handles the voice note transcription process.
 * - VoiceToCRMInput - The input type for the voiceToCRM function.
 * - VoiceToCRMOutput - The return type for the voiceToCRM function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const VoiceToCRMInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      'A voice note as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.' // Corrected format
    ),
});
export type VoiceToCRMInput = z.infer<typeof VoiceToCRMInputSchema>;

const VoiceToCRMOutputSchema = z.object({
  transcription: z.string().describe('The transcription of the voice note.'),
});
export type VoiceToCRMOutput = z.infer<typeof VoiceToCRMOutputSchema>;

export async function voiceToCRM(input: VoiceToCRMInput): Promise<VoiceToCRMOutput> {
  return voiceToCRMFlow(input);
}

const voiceToCRMPrompt = ai.definePrompt({
  name: 'voiceToCRMPrompt',
  input: {schema: VoiceToCRMInputSchema},
  output: {schema: VoiceToCRMOutputSchema},
  prompt: `You are an AI assistant that transcribes voice notes.

  Transcribe the following voice note.

  Voice Note: {{media url=audioDataUri}}

  Transcription:`,
});

const voiceToCRMFlow = ai.defineFlow(
  {
    name: 'voiceToCRMFlow',
    inputSchema: VoiceToCRMInputSchema,
    outputSchema: VoiceToCRMOutputSchema,
  },
  async input => {
    const {output} = await voiceToCRMPrompt(input);
    return output!;
  }
);
