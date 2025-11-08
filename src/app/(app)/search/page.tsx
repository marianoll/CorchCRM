import { NaturalLanguageSearch } from '@/components/natural-language-search';

export default function SearchPage() {
  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight font-headline">Natural Language Search</h1>
            <p className="text-muted-foreground">Search your CRM data using everyday language.</p>
        </div>
        <NaturalLanguageSearch />
      </div>
    </main>
  );
}
