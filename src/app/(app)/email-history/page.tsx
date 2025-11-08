'use client';

import { Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function EmailHistoryPage() {
  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
            <Mail className="h-7 w-7" />
            Email History
          </h1>
          <p className="text-muted-foreground">A log of all emails processed by the system.</p>
        </div>
        <Card>
            <CardHeader>
                <CardTitle>Email Logs</CardTitle>
                <CardDescription>Emails processed by the AI will appear here.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center">
                    <h3 className="text-lg font-semibold">No Emails Yet</h3>
                    <p className="text-sm text-muted-foreground">Once emails are processed, they will be logged here.</p>
                </div>
            </CardContent>
        </Card>
      </div>
    </main>
  );
}
