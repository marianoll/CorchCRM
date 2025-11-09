'use server';
/**
 * @fileOverview A simple debugging flow for Genkit.
 *
 * - debugEcho - A flow that echoes back the input message.
 * - DebugEchoInput - The input type for the flow.
 * - DebugEchoOutput - The return type for the flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const DebugEchoInputSchema = z.object({
  message: z.string().describe('The message to be echoed.'),
});
export type DebugEchoInput = z.infer<typeof DebugEchoInputSchema>;

const DebugEchoOutputSchema = z.object({
  echo: z.string().describe('The echoed message.'),
});
export type DebugEchoOutput = z.infer<typeof DebugEchoOutputSchema>;

export const debugEcho = ai.defineFlow(
  {
    name: 'debugEcho',
    inputSchema: DebugEchoInputSchema,
    outputSchema: DebugEchoOutputSchema,
  },
  async (input) => {
    console.log('[Genkit Debug] Received input in debugEcho flow:', JSON.stringify(input, null, 2));
    
    if (!input || typeof input.message !== 'string') {
        console.error('[Genkit Debug] Invalid input received.');
        throw new Error('Invalid input: message must be a string.');
    }

    const outputMessage = `ECHO: ${input.message}`;
    
    console.log('[Genkit Debug] Returning output:', outputMessage);
    
    return {
      echo: outputMessage,
    };
  }
);
