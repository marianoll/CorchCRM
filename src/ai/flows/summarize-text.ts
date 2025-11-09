'use server';
/**
 * A Genkit flow for summarizing a given text into a single line.
 */

import { ai } from '@/ai';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

// ---- Schemas ----
const SummarizeTextInputSchema = z.object({
  text: z.string().describe('The text to be summarized.'),
});
export type SummarizeTextInput = z.infer<typeof SummarizeTextInputSchema>;

const SummarizeTextOutputSchema = z.object({
  summary: z.string().describe('The one-line summary of the text.'),
});
export type SummarizeTextOutput = z.infer<typeof SummarizeTextOutputSchema>;

// ---- Prompt ----
// Cambiado a un modelo vigente: gemini-2.5-flash
const summarizeTextPrompt = ai.definePrompt({
  name: 'summarizeTextPrompt',
  model: googleAI.model('gemini-1.5-flash-latest'),
  input: { schema: SummarizeTextInputSchema },
  output: { schema: SummarizeTextOutputSchema },
  // Reglas para asegurar una sola línea y sin ruido
  prompt: `You are a concise assistant.
Return a single-line summary (max 160 characters). No newlines, no quotes, no prefaces.

Text:
---
{{text}}
---

Return JSON that matches the output schema:
{"summary": "<one line>"}`,
});

// ---- Flow ----
const summarizeTextFlow = ai.defineFlow(
  {
    name: 'summarizeTextFlow',
    inputSchema: SummarizeTextInputSchema,
    outputSchema: SummarizeTextOutputSchema,
  },
  async (input) => {
    // Guard clause por inputs muy cortos
    if (!input.text || input.text.trim().length < 10) {
      return { summary: 'Not enough text to summarize.' };
    }

    try {
      const res = await summarizeTextPrompt(input);
      // Genkit: defensivo por si la forma cambia
      const out = (typeof res?.output === 'function')
        ? res.output()
        : (res as any)?.output ?? null;

      let summary = out?.summary ?? '';

      // Normaliza siempre a una sola línea
      summary = summary.replace(/\s+/g, ' ').trim();
      if (!summary) summary = 'Could not generate summary.';

      return { summary };
    } catch (err) {
      console.error('[summarizeTextFlow] Error:', err);
      return { summary: 'Could not generate summary.' };
    }
  }
);

// ---- API ----
export async function summarizeText(
  input: SummarizeTextInput
): Promise<SummarizeTextOutput> {
  return summarizeTextFlow(input);
}
