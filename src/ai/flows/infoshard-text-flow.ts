'use server';
/**
 * @fileOverview A Genkit flow to process unstructured text into structured "infotopes" and "orchestrator" commands.
 *
 * - infoshardText - A function that calls the Genkit flow.
 * - InfoshardTextInput - The input type for the flow.
 * - InfoshardTextOutput - The output type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

// ---- Schemas ----
const InfoshardTextInputSchema = z.object({
  text: z.string().describe('The unstructured text to be processed.'),
});
export type InfoshardTextInput = z.infer<typeof InfoshardTextInputSchema>;

const InfoshardTextOutputSchema = z.object({
  infotopes: z
    .array(z.string())
    .describe('A list of atomic facts or data points extracted from the text.'),
  orchestrators: z
    .array(z.string())
    .describe(
      'A list of plain-text instructions for the AI orchestrator based on the text.'
    ),
});
export type InfoshardTextOutput = z.infer<typeof InfoshardTextOutputSchema>;

// ---- Prompt ----
const infoshardTextPrompt = ai.definePrompt({
  name: 'infoshardTextPrompt',
  model: googleAI.model('gemini-1.5-flash-latest'),
  input: { schema: InfoshardTextInputSchema },
  output: { schema: InfoshardTextOutputSchema },
  prompt: `You are an expert text analysis AI. Your task is to extract structured data from unstructured text.
Analyze the following text and perform two tasks:
1.  Extract "infotopes", which are atomic, self-contained facts. Examples: "Contact name is Javier Gomez", "Company is Tech Solutions", "Budget is $50k", "Needs proposal by Friday EOD".
2.  Generate "orchestrators", which are plain-text, imperative commands for another AI to execute. Examples: "Create contact: Javier Gomez (Tech Solutions)", "Update deal 'Cloud Migration' with amount $50,000", "Create task: 'Send proposal to Javier' due Friday".

Text to analyze:
---
{{text}}
---

Return a JSON object that strictly matches the output schema.
`,
});

// ---- Flow ----
const infoshardTextFlow = ai.defineFlow(
  {
    name: 'infoshardTextFlow',
    inputSchema: InfoshardTextInputSchema,
    outputSchema: InfoshardTextOutputSchema,
  },
  async (input) => {
    if (!input.text || input.text.trim().length < 10) {
      return { infotopes: [], orchestrators: ['Input text is too short.'] };
    }

    try {
      const res = await infoshardTextPrompt(input);
      const output = res.output;

      if (!output) {
        throw new Error('No output from AI model.');
      }

      return {
        infotopes: output.infotopes || [],
        orchestrators: output.orchestrators || [],
      };
    } catch (err: any) {
      console.error('[infoshardTextFlow] Error:', err);
      throw new Error(err.message || 'Could not process text.');
    }
  }
);

// ---- API ----
export async function infoshardText(
  input: InfoshardTextInput
): Promise<InfoshardTextOutput> {
  return infoshardTextFlow(input);
}
