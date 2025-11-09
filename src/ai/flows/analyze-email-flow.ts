'use server';
/**
 * @fileOverview A Genkit flow that analyzes an email to suggest CRM updates.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

// ---- Schemas ----

const DealSchema = z.object({
  id: z.string(),
  title: z.string(),
  stage: z.string(),
  amount: z.number(),
});

const AnalysisInputSchema = z.object({
  emailBody: z.string().describe('The full body of the email to analyze.'),
  emailSubject: z.string().describe('The subject of the email.'),
  currentDeal: DealSchema.describe('The current state of the deal associated with this email.'),
});
export type AnalysisInput = z.infer<typeof AnalysisInputSchema>;

const StageSuggestionSchema = z.object({
  newStage: z.string().describe('The suggested new stage for the deal (e.g., "Negotiation", "Won").'),
  probability: z.number().min(0).max(1).describe('The AI\'s confidence in this stage change (0 to 1).'),
  reason: z.string().describe('A brief explanation for why this stage change is suggested.'),
});

const DataUpdateSuggestionSchema = z.object({
  field: z.string().describe('The specific field in the deal to update (e.g., "amount").'),
  currentValue: z.any().describe('The current value of the field.'),
  suggestedValue: z.any().describe('The new value suggested by the AI.'),
  reason: z.string().describe('A brief explanation for why this update is suggested.'),
});

const AnalysisOutputSchema = z.object({
  stageSuggestion: StageSuggestionSchema.optional(),
  dataUpdates: z.array(DataUpdateSuggestionSchema).optional(),
});
export type AnalysisOutput = z.infer<typeof AnalysisOutputSchema>;


// ---- Prompt ----

const analysisPrompt = ai.definePrompt({
  name: 'analyzeEmailContentPrompt',
  model: googleAI.model('gemini-1.5-flash-latest'),
  input: { schema: AnalysisInputSchema },
  output: { schema: AnalysisOutputSchema },
  prompt: `You are a CRM analyst AI. Your task is to analyze an email regarding a deal and suggest updates.

**Current Deal State:**
- Title: {{currentDeal.title}}
- Stage: {{currentDeal.stage}}
- Amount: {{currentDeal.amount}}

**Email to Analyze:**
- Subject: {{emailSubject}}
- Body:
---
{{emailBody}}
---

**Your Tasks:**

1.  **Analyze Stage Change:** Based on the email content, determine if the deal is likely to move to a new stage (e.g., from 'Proposal' to 'Negotiation', or 'Negotiation' to 'Won'). If so, provide the new stage, your confidence probability, and a brief reason. Do not suggest a stage if the confidence is low.

2.  **Identify Data Updates:** Scan the email for any explicit changes to key deal data, such as the 'amount'. If you find any, create a suggestion to update that field with the new value. Provide the field name, its current value, the new suggested value, and a reason.

**Output Format:**
Return a JSON object matching the defined output schema. If you have no suggestions for a category (e.g., no data updates), you can omit that key.
`,
});


// ---- Flow ----

const analyzeEmailFlow = ai.defineFlow(
  {
    name: 'analyzeEmailFlow',
    inputSchema: AnalysisInputSchema,
    outputSchema: AnalysisOutputSchema,
  },
  async (input) => {
    const llmResponse = await analysisPrompt(input);
    return llmResponse.output || {};
  }
);


// ---- API Export ----

export async function analyzeEmailContent(input: AnalysisInput): Promise<AnalysisOutput> {
  return analyzeEmailFlow(input);
}
