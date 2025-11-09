'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Bug, LoaderCircle, CheckCircle, XCircle, PlayCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { debugEcho } from '@/ai/flows/debug-echo';

type TestStatus = 'pending' | 'running' | 'passed' | 'failed';

const statusConfig = {
    pending: { icon: PlayCircle, color: 'text-muted-foreground', label: 'Pending' },
    running: { icon: LoaderCircle, color: 'text-blue-500 animate-spin', label: 'Running' },
    passed: { icon: CheckCircle, color: 'text-green-500', label: 'Passed' },
    failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
}

export default function GenkitDebugPage() {
    const [testStatus, setTestStatus] = useState<TestStatus>('pending');
    const [testResult, setTestResult] = useState<string | null>(null);
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    const runFlowInvocationTest = () => {
        setTestStatus('running');
        setTestResult(null);
        const testMessage = `Hello Genkit, this is a test at ${new Date().toISOString()}`;

        startTransition(async () => {
            try {
                console.log(`[Client-Side Test] Sending: "${testMessage}"`);
                const result = await debugEcho({ message: testMessage });
                
                if (result.echo === `ECHO: ${testMessage}`) {
                    setTestStatus('passed');
                    setTestResult(`Success! Flow returned the expected echo:\n\nINPUT:\n${testMessage}\n\nOUTPUT:\n${result.echo}`);
                    toast({ title: 'Test Passed', description: 'The Genkit flow responded correctly.' });
                } else {
                    setTestStatus('failed');
                    setTestResult(`Test failed. The flow returned an unexpected value.\n\nExpected: "ECHO: ${testMessage}"\nReceived: "${result.echo}"`);
                    toast({ variant: 'destructive', title: 'Test Failed', description: 'The flow returned an unexpected value.' });
                }

            } catch (error: any) {
                console.error('[Client-Side Test] Error invoking flow:', error);
                setTestStatus('failed');
                setTestResult(`Test failed with an error.\n\nError Message:\n${error.message}\n\nCheck the browser console and server logs for more details.`);
                toast({ variant: 'destructive', title: 'Test Failed', description: 'An error occurred while invoking the flow.' });
            }
        });
    };
    
    const TestIcon = statusConfig[testStatus].icon;

    return (
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
                        <Bug className="h-7 w-7" />
                        Genkit Pipeline Debugger
                    </h1>
                    <p className="text-muted-foreground">A series of tests to diagnose the Genkit pipeline from client to server.</p>
                </div>

                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>Flow Invocation Test</CardTitle>
                                <CardDescription>Checks if a simple Genkit flow can be invoked from the client and return a predictable value.</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <TestIcon className={`h-5 w-5 ${statusConfig[testStatus].color}`} />
                                <span className={`text-sm font-medium ${statusConfig[testStatus].color}`}>{statusConfig[testStatus].label}</span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {testResult && (
                             <div className="p-4 bg-secondary rounded-md text-sm">
                                <h4 className="font-semibold mb-2">Test Output:</h4>
                                <pre className="whitespace-pre-wrap font-mono text-xs">{testResult}</pre>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter>
                         <Button onClick={runFlowInvocationTest} disabled={isPending}>
                            {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                            Run Test
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </main>
    )
}
