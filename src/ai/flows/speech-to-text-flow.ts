'use server';
/**
 * @fileOverview A Genkit flow for transcribing audio to text.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

// ---------- Schemas ----------
const SpeechToTextInputSchema = z.object({
  audioDataUri: z
    .string()
    .min(1, 'audioDataUri is required')
    .describe("Audio as Data URI. Example: 'data:audio/webm;base64,...'"),
});
export type SpeechToTextInput = z.infer<typeof SpeechToTextInputSchema>;

const SpeechToTextOutputSchema = z.object({
  transcript: z.string().describe('Transcribed text from the audio.'),
});
export type SpeechToTextOutput = z.infer<typeof SpeechToTextOutputSchema>;

// ---------- Prompt ----------
const transcribePrompt = ai.definePrompt({
  name: 'transcribeAudioPrompt',
  // Model con soporte audio multimodal estable
  model: googleAI.model('gemini-1.5-flash-latest'),
  input: { schema: SpeechToTextInputSchema },
  // Nota: {{media url=...}} acepta data URIs
  prompt: `You are an accurate speech transcriber. 
Return only the verbatim transcript text (no labels, no timestamps, no extra words).

Audio:
{{media url=audioDataUri}}`,
});

// ---------- Flow ----------
const speechToTextFlow = ai.defineFlow(
  {
    name: 'speechToTextFlow',
    inputSchema: SpeechToTextInputSchema,
    outputSchema: SpeechToTextOutputSchema,
  },
  async (input) => {
    // Validación mínima del Data URI para evitar llamadas inútiles
    if (!input.audioDataUri.startsWith('data:audio/')) {
      throw new Error(
        'audioDataUri must be a valid audio data URI (e.g., data:audio/webm;base64,...)'
      );
    }

    // Llamada al prompt
    const llmResponse = await transcribePrompt(input);

    const transcript = llmResponse.text ?? '';

    if (!transcript.trim()) {
      throw new Error('Could not transcribe audio (empty response).');
    }

    return { transcript: transcript.trim() };
  }
);

// ---------- Export ----------
export async function speechToText(
  input: SpeechToTextInput
): Promise<SpeechToTextOutput> {
  return speechToTextFlow(input);
}
