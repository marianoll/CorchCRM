import { SuggestionCard } from '@/components/suggestion-card';
import { suggestionData } from '@/lib/mock-data';

export default function InboxPage() {
  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight font-headline">Zero-Click Inbox</h1>
            <p className="text-muted-foreground">Review and approve AI-generated suggestions for your CRM.</p>
        </div>
        <div className="space-y-4">
            {/* In a real app, this would be dynamic. For now, we use a message for an empty state. */}
            {suggestionData.length > 0 ? (
                suggestionData.map((suggestion) => (
                    <SuggestionCard key={suggestion.id} suggestion={suggestion} />
                ))
            ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
                    <h3 className="text-lg font-semibold">All Caught Up!</h3>
                    <p className="text-sm text-muted-foreground">There are no new AI suggestions to review.</p>
                </div>
            )}
        </div>
      </div>
    </main>
  );
}
