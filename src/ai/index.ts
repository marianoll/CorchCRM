/**
 * @fileOverview Initializes and configures the Genkit AI instance.
 */
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
