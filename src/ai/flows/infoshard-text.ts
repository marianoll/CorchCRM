'use server';
/**
 * @fileOverview An AI agent that processes raw text into a structured "infoshard".
 *
 * - infoshardText - The primary function to process text.
 * - InfoshardTextInput - The input type for the function.
 * - InfoshardTextOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const InfoshardTextInputSchema = z.object({
  text: z.string().describe('The raw text to be processed into an infoshard.'),
});
export type InfoshardTextInput = z.infer<typeof InfoshardTextInputSchema>;

const InfoshardTextOutputSchema = z.object({
  shard: z.string().describe('A concise, structured, and atomic piece of information derived from the original text.'),
});
export type InfoshardTextOutput = z.infer<typeof InfoshardTextOutputSchema>;


const infoshardTextPrompt = ai.definePrompt({
  name: 'infoshardTextPrompt',
  input: { schema: InfoshardTextInputSchema },
  output: { schema: InfoshardTextOutputSchema },
  system: `You are an expert AI assistant. Your task is to extract a single, dense, and verifiable piece of information from the provided text and format it as a concise "infoshard".

An "infoshard" is an atomic fact. It should be self-contained and clearly state one piece of information.

Example:
Input Text: "Just spoke with Jane from Acme. She needs a proposal for the Q3 project by Friday. Budget is roughly $25k."
Output Shard: "Acme needs a proposal for the Q3 project by Friday, with an approximate budget of $25k."

Now, process the user's text.`,
  user: `Text to be processed:\n'''\n{{{text}}}\n'''`,
});

export const infoshardText = ai.defineFlow(
  {
    name: 'infoshardText',
    inputSchema: InfoshardTextInputSchema,
    outputSchema: InfoshardTextOutputSchema,
  },
  async (input) => {
    // DEBUGGING: Log the input received by the flow.
    console.log('Infoshard flow received input:', JSON.stringify(input, null, 2));

    if (!input || typeof input.text !== 'string' || input.text.trim() === '') {
        console.error("Infoshard flow received invalid or empty input. Aborting.");
        return { shard: '' };
    }

    const { output } = await infoshardTextPrompt(input);
    
    return output || { shard: '' };
  }
);
