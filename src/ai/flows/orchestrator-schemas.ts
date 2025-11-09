
import { z } from 'zod';

/* ---------- Schemas (Acciones específicas) ---------- */

export const ActionSchema = z.object({
  type: z.enum([
    'update_entity',      // update data
    'create_ai_draft',    // email draft
    'create_meeting',     // schedule meeting
    'create_task'         // follow-up task
  ]),
  target: z.enum([
    'companies','contacts','deals','emails','tasks','ai_drafts','meetings'
  ]),
  id: z.string().optional(),              // for update_entity
  data: z.any().optional(),     // for create_*
  changes: z.any().optional(),  // for update_entity
  reason: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  date: z.string().optional()             // ISO UTC for scheduled items
});

export const OrchestratorInputSchema = z.object({
  interaction: z.object({
    source: z.enum(['email','voice','meeting','note']),
    subject: z.string().optional(),
    body: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    timestamp: z.string().optional(),
    direction: z.enum(['inbound','outbound']).optional()
  }),
  related_entities: z.record(z.any()).optional(), // { deal, contact, company ... }
  policy: z.record(z.any()).optional()
});

export const OrchestratorOutputSchema = z.object({
  actions: z.array(ActionSchema).default([])
});

export type OrchestratorInput  = z.infer<typeof OrchestratorInputSchema>;
export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type Interaction = z.infer<typeof OrchestratorInputSchema>['interaction'];
