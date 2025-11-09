import { config } from 'dotenv';
config({ path: '.env.local' });

import '@/ai/flows/summarize-text.ts';
import '@/ai/flows/canary-flows.ts';
import '@/ai/flows/gmail-auth-flow.ts';
import '@/ai/flows/infoshard-text-flow.ts';
import '@/ai/flows/natural-language-search.ts';
import '@/ai/flows/orchestrator-flow.ts';
import '@/ai/flows/review-ai-suggestions.ts';
import '@/ai/flows/sync-gmail-flow.ts';
