'use server';
/**
 * @fileOverview A Genkit flow for summarizing a given text into a single line.
 *
 * - summarizeText - A function that takes a string of text and returns a one-line summary.
 * - SummarizeTextInput - The input type for the summarizeText function.
 * - SummarizeTextOutput - The return type for the summarizeText function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

// Define the input schema for the flow
const SummarizeTextInputSchema = z.object({
  text: z.string().describe('The text to be summarized.'),
});
export type SummarizeTextInput = z.infer<typeof SummarizeTextInputSchema>;

// Define the output schema for the flow
const SummarizeTextOutputSchema = z.object({
  summary: z.string().describe('The one-line summary of the text.'),
});
export type SummarizeTextOutput = z.infer<typeof SummarizeTextOutputSchema>;

// Define the prompt that will be used by the AI model
const summarizeTextPrompt = ai.definePrompt({
  name: 'summarizeTextPrompt',
  input: { schema: SummarizeTextInputSchema },
  output: { schema: SummarizeTextOutputSchema },
  prompt: `Summarize the following text into a single, concise line:

---
{{text}}
---`,
});

// Define the main flow function
const summarizeTextFlow = ai.defineFlow(
  {
    name: 'summarizeTextFlow',
    inputSchema: SummarizeTextInputSchema,
    outputSchema: SummarizeTextOutputSchema,
  },
  async (input) => {
    // If the input text is empty or too short, return a default message
    if (!input.text || input.text.trim().length < 10) {
      return { summary: 'Not enough text to summarize.' };
    }
    
    // Call the prompt with the provided input
    const response = await summarizeTextPrompt(input);
    const output = response.output();

    // Return the generated summary or a fallback message
    return output || { summary: 'Could not generate summary.' };
  }
);

// Export a wrapper function to be easily called from client components
export async function summarizeText(
  input: SummarizeTextInput
): Promise<SummarizeTextOutput> {
  return summarizeTextFlow(input);
}
