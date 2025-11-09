'use server';
/**
 * @fileOverview An AI agent that summarizes text into a single line.
 *
 * - summarizeText - The primary function to process text.
 * - SummarizeTextInput - The input type for the function.
 * - SummarizeTextOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const SummarizeTextInputSchema = z.object({
  text: z.string().describe('The raw text to be summarized.'),
});
export type SummarizeTextInput = z.infer<typeof SummarizeTextInputSchema>;

const SummarizeTextOutputSchema = z.object({
  summary: z.string().describe('A concise, one-line summary of the original text.'),
});
export type SummarizeTextOutput = z.infer<typeof SummarizeTextOutputSchema>;

const summarizeTextPrompt = ai.definePrompt({
  name: 'summarizeTextPrompt',
  input: { schema: SummarizeTextInputSchema },
  output: { schema: SummarizeTextOutputSchema },
  system: `You are an expert at summarizing text. Your task is to read the provided text and create a concise, one-line summary. The summary should capture the main point of the text.`,
  user: `Text to be summarized:\n'''\n{{{text}}}\n'''`,
});

export const summarizeText = ai.defineFlow(
  {
    name: 'summarizeText',
    inputSchema: SummarizeTextInputSchema,
    outputSchema: SummarizeTextOutputSchema,
  },
  async (input) => {
    if (!input || typeof input.text !== 'string' || input.text.trim() === '') {
        return { summary: 'No text provided.' };
    }

    const response = await summarizeTextPrompt(input);
    const output = response.output;
    
    return output || { summary: 'Could not generate summary.' };
  }
);
