'use server';
/**
 * @fileOverview A Genkit flow for transcribing audio to text.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';


const SpeechToTextInputSchema = z.object({
  audioDataUri: z.string().describe("Audio data encoded as a data URI. Expected format: 'data:audio/webm;base64,...'"),
});
export type SpeechToTextInput = z.infer<typeof SpeechToTextInputSchema>;


const SpeechToTextOutputSchema = z.object({
  transcript: z.string().describe('The transcribed text from the audio.'),
});
export type SpeechToTextOutput = z.infer<typeof SpeechToTextOutputSchema>;


const transcribePrompt = ai.definePrompt({
    name: 'transcribeAudioPrompt',
    model: googleAI.model('gemini-2.0-flash-lite'),
    input: { schema: SpeechToTextInputSchema },
    prompt: `Transcribe the following audio recording. Provide only the text content of the speech, without any additional formatting or labels.

Audio: {{media url=audioDataUri}}
`,
});


const speechToTextFlow = ai.defineFlow(
  {
    name: 'speechToTextFlow',
    inputSchema: SpeechToTextInputSchema,
    outputSchema: SpeechToTextOutputSchema,
  },
  async (input) => {
    const llmResponse = await transcribePrompt(input);
    const transcript = llmResponse.text;
    
    if (!transcript) {
        throw new Error('Could not transcribe audio.');
    }
    
    return { transcript: transcript.trim() };
  }
);


export async function speechToText(input: SpeechToTextInput): Promise<SpeechToTextOutput> {
  return speechToTextFlow(input);
}
