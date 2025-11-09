
'use server';

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { z } from 'zod';

/* ---------- Esquemas mínimos ---------- */

const ActionSchema = z.object({
  type: z.enum([
    'update_entity','create_entity','create_task','create_ai_draft',
    'create_meeting','notify_user','log_action','suggest'
  ]),
  target: z.enum([
    'companies','contacts','deals','emails','tasks','ai_drafts','meetings','notifications','history'
  ]),
  id: z.string().optional(),
  data: z.record(z.any()).optional(),     // para create_*
  changes: z.record(z.any()).optional(),  // para update_*
  reason: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  date: z.string().optional()
});

const OrchestratorInputSchema = z.object({
  interaction: z.object({
    source: z.enum(['email','voice','meeting','note']),
    subject: z.string().optional(),
    body: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    timestamp: z.string().optional()
  }),
  // Simplificados: objetos libres para no pelear con validaciones
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


/* ---------- Prompt mínimo ---------- */

const orchestratePrompt = ai.definePrompt({
  name: 'orchestrateInteraction',
  model: googleAI.model('gemini-2.5-flash'),
  input:  { schema: OrchestratorInputSchema },
  output: { schema: OrchestratorOutputSchema },
  prompt: `
You are CorchCRM's Orchestrator AI.
Output ONLY a JSON object with an "actions" array. No extra text.

Entities: companies, contacts, deals, emails, tasks, meetings, notifications, ai_drafts, history.
Actions: update_entity, create_entity, create_task, create_ai_draft, create_meeting, notify_user, log_action, suggest.

Rules:
- Small, atomic actions.
- Each action should include a concise "reason".
- Include "confidence" (0..1) when making decisions.
- If unsure, use "suggest".
- Log all changes with a "log_action".
- Use ISO UTC times.

Interaction:
{{interaction}}

Related entities:
{{related_entities}}

Policy:
{{policy}}

Return JSON strictly matching the output schema.
`
});

/* ---------- Flow mínimo ---------- */

const orchestrateInteractionFlow = ai.defineFlow(
  { name: 'orchestrateInteractionFlow', inputSchema: OrchestratorInputSchema, outputSchema: OrchestratorOutputSchema },
  async (input): Promise<OrchestratorOutput> => {
    if (!input?.interaction?.source) {
      return { actions: [{ type: 'log_action', target: 'history', reason: 'Invalid input: missing interaction.source', confidence: 0 }] };
    }
    try {
      const res = await orchestratePrompt(input);
      const out = typeof (res as any)?.output === 'function' ? (res as any).output() : (res as any)?.output;
      return { actions: Array.isArray(out?.actions) ? out.actions : [] };
    } catch (e:any) {
      console.error('[orchestrateInteractionFlow]', e?.message || e);
      return { actions: [{ type: 'log_action', target: 'history', reason: 'Model call failed', confidence: 0 }] };
    }
  }
);

/* ---------- Helper ---------- */

export async function orchestrateInteraction(input: OrchestratorInput): Promise<OrchestratorOutput> {
  return orchestrateInteractionFlow(input);
}
