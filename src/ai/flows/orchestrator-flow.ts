'use server';

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

/* ---------- Schemas (Acciones específicas) ---------- */

const ActionSchema = z.object({
  type: z.enum([
    'update_entity', // Para 'update_data'
    'create_ai_draft', // Para 'create_email'
    'create_meeting',
    'create_task' // Se mantiene para seguimientos
  ]),
  target: z.enum([
    'companies','contacts','deals','emails','tasks','ai_drafts','meetings'
  ]),
  id: z.string().optional(),              // para update_entity
  data: z.record(z.any()).optional(),     // para create_*
  changes: z.record(z.any()).optional(),  // para update_entity
  reason: z.string().describe("A concise, one-line explanation of the action to be performed, e.g., 'Update deal amount to $50,000' or 'Create task to send follow-up email.'"),
  confidence: z.number().min(0).max(1).optional(),
  date: z.string().optional().describe("ISO UTC timestamp for scheduled actions like meetings or future tasks.")
});

const OrchestratorInputSchema = z.object({
  interaction: z.object({
    source: z.enum(['email','voice','meeting','note']),
    subject: z.string().optional(),
    body: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    timestamp: z.string().optional(),
    direction: z.enum(['inbound', 'outbound']).optional(), // Añadido para la nueva lógica
  }),
  related_entities: z.record(z.any()).optional(),
  policy: z.record(z.any()).optional()
});

const OrchestratorOutputSchema = z.object({
  actions: z.array(ActionSchema).default([])
});

export type OrchestratorInput  = z.infer<typeof OrchestratorInputSchema>;
export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Interaction = z.infer<typeof OrchestratorInputSchema>['interaction'];

/* ---------- Prompt (Lógica de negocio específica) ---------- */

const orchestratePrompt = ai.definePrompt({
  name: 'orchestrateInteraction',
  model: googleAI.model('gemini-2.0-flash-lite'),
  input:  { schema: OrchestratorInputSchema },
  output: { schema: OrchestratorOutputSchema },
  prompt: `
You are CorchCRM's Orchestrator AI.
Your task is to analyze an interaction and generate a list of concrete actions.
Return ONLY a JSON object with an "actions" array. No extra text.

**Allowed Actions:**
- \`create_ai_draft\`: To draft an email.
- \`create_task\`: To schedule a future task (like a follow-up).
- \`update_entity\`: To change data in a contact, company, or deal.
- \`create_meeting\`: To schedule a meeting.

**Business Logic Rules:**

1.  **Email Drafting Logic (Mandatory):**
    *   If the interaction's \`direction\` is \`inbound\`, you MUST generate a \`create_ai_draft\` action to draft an immediate response. The 'reason' should be "Draft response to inbound email".
    *   If the interaction's \`direction\` is \`outbound\`, you MUST generate a \`create_task\` action to follow up in 5 days. The 'reason' should be "Schedule follow-up for outbound email" and the 'date' should be 5 days from now.

2.  **Data Update Logic:**
    *   Carefully read the email body (\`interaction.body\`).
    *   If you find information that changes an existing entity (e.g., a deal's amount or stage, a contact's phone number), you MUST generate an \`update_entity\` action.
    *   The 'target' should be 'deals', 'contacts', or 'companies'.
    *   The 'id' must be the ID of the entity to update.
    *   The 'changes' field must contain ONLY the fields to be updated (e.g., \`{"amount": 50000}\`).
    *   The 'reason' must be specific, like "Update deal amount to $50,000".

3.  **Meeting Creation Logic:**
    *   If the email body mentions scheduling a meeting, a call, or a demo, you MUST generate a \`create_meeting\` action.
    *   The 'reason' should be "Schedule meeting as requested in email".
    *   Extract the proposed date and time if available and put it in the 'date' field.

**Input Context:**
- Interaction: {{interaction}}
- Related Entities: {{related_entities}}

Return JSON strictly matching the output schema.
`
});

/* ---------- Flow ---------- */

const orchestrateInteractionFlow = ai.defineFlow(
  { name: 'orchestrateInteractionFlow', inputSchema: OrchestratorInputSchema, outputSchema: OrchestratorOutputSchema },
  async (input): Promise<OrchestratorOutput> => {
    if (!input?.interaction?.source) {
      console.warn('[orchestrateInteractionFlow] Missing interaction.source');
      return { actions: [] };
    }
    try {
      const res = await orchestratePrompt(input);
      const output = res.output;

      if (!output || !Array.isArray(output.actions)) {
        console.warn('AI did not return a valid action array.');
        return { actions: [] };
      }

      // Defensive filtering to ensure only allowed actions are returned.
      const validTypes = new Set(['update_entity', 'create_ai_draft', 'create_meeting', 'create_task']);
      const validTargets = new Set(['companies', 'contacts', 'deals', 'emails', 'tasks', 'ai_drafts', 'meetings']);

      const concreteActions = output.actions.filter(a => a && validTypes.has(a.type) && validTargets.has(a.target));
      return { actions: concreteActions };

    } catch (e:any) {
      console.error('[orchestrateInteractionFlow]', e?.message || e);
      return { actions: [] }; // Return empty on error
    }
  }
);

/* ---------- Helper ---------- */

export async function orchestrateInteraction(input: OrchestratorInput): Promise<OrchestratorOutput> {
  return orchestrateInteractionFlow(input);
}
