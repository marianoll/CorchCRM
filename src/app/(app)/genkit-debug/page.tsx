
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Bug, LoaderCircle, CheckCircle, XCircle, PlayCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { pingFlow, echoInputFlow, echoMessageFlow, staticResultFlow } from '@/ai/flows/canary-flows';
import { Input } from '@/components/ui/input';

type TestStatus = 'pending' | 'running' | 'passed' | 'failed';

const statusConfig = {
    pending: { icon: PlayCircle, color: 'text-muted-foreground', label: 'Pending' },
    running: { icon: LoaderCircle, color: 'text-blue-500 animate-spin', label: 'Running' },
    passed: { icon: CheckCircle, color: 'text-green-500', label: 'Passed' },
    failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
};

const TestStatusIndicator = ({ status }: { status: TestStatus }) => {
    const Icon = statusConfig[status].icon;
    return (
        <div className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${statusConfig[status].color}`} />
            <span className={`text-sm font-medium ${statusConfig[status].color}`}>{statusConfig[status].label}</span>
        </div>
    );
}

interface TestCardProps {
    title: string;
    description: string;
    testId: string;
    onRun: () => Promise<{ success: boolean; result: any }>;
    children?: React.ReactNode;
}

const TestCard: React.FC<TestCardProps> = ({ title, description, testId, onRun, children }) => {
    const [status, setStatus] = useState<TestStatus>('pending');
    const [result, setResult] = useState<any | null>(null);
    const [isPending, startTransition] = useTransition();

    const handleRun = () => {
        setStatus('running');
        setResult(null);
        startTransition(async () => {
            const { success, result } = await onRun();
            setStatus(success ? 'passed' : 'failed');
            setResult(result);
        });
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>{title}</CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </div>
                    <TestStatusIndicator status={status} />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <>
                    {children}
                    {result && (
                        <div className="p-4 bg-secondary rounded-md text-sm">
                            <h4 className="font-semibold mb-2">Raw JSON Output:</h4>
                            <pre className="whitespace-pre-wrap font-mono text-xs">{JSON.stringify(result, null, 2)}</pre>
                        </div>
                    )}
                </>
            </CardContent>
            <CardFooter>
                <Button onClick={handleRun} disabled={isPending}>
                    {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                    Run Test
                </Button>
            </CardFooter>
        </Card>
    );
};


export default function GenkitDebugPage() {
    const { toast } = useToast();
    const [echoInputText, setEchoInputText] = useState('{"message": "Hello World"}');
    const [echoMessageText, setEchoMessageText] = useState('This is a test message');

    const runPingTest = async () => {
        try {
            const result = await pingFlow();
            const success = result?.ok === true;
            if (success) toast({ title: 'Ping Test Passed' });
            else toast({ variant: 'destructive', title: 'Ping Test Failed', description: 'Did not receive { ok: true }' });
            return { success, result };
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Ping Test Error', description: error.message });
            return { success: false, result: { error: error.message } };
        }
    };

    const runEchoInputTest = async () => {
        try {
            const payload = JSON.parse(echoInputText);
            const result = await echoInputFlow(payload);
            const success = typeof result === 'object' && result !== null && Object.keys(result).length > 0;
            if(success) toast({ title: 'Echo Input Test Passed' });
            else toast({ variant: 'destructive', title: 'Echo Input Test Failed', description: 'Received an empty or invalid object.' });
            return { success, result };
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Echo Input Test Error', description: error.message });
            return { success: false, result: { error: error.message } };
        }
    };
    
    const runEchoMessageTest = async () => {
        try {
            const payload = { message: echoMessageText };
            const result = await echoMessageFlow(payload);
            const success = result === echoMessageText;
            if(success) toast({ title: 'Echo Message Test Passed' });
            else toast({ variant: 'destructive', title: 'Echo Message Test Failed', description: 'The echoed message did not match the input.' });
            return { success, result };
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Echo Message Test Error', description: error.message });
            return { success: false, result: { error: error.message } };
        }
    };

    const runStaticResultTest = async () => {
        try {
            const result = await staticResultFlow();
            const success = result?.infotopes && Array.isArray(result.infotopes) && result.orchestrators;
            if(success) toast({ title: 'Static Result Test Passed' });
            else toast({ variant: 'destructive', title: 'Static Result Test Failed', description: 'The returned object did not match the expected schema.' });
            return { success, result };
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Static Result Test Error', description: error.message });
            return { success: false, result: { error: error.message } };
        }
    };

    return (
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
                        <Bug className="h-7 w-7" />
                        Genkit Pipeline Debugger
                    </h1>
                    <p className="text-muted-foreground">A suite of canary tests to diagnose the Genkit pipeline from client to server.</p>
                </div>

                <TestCard title="Ping Flow Test (#5)" description="Tests basic infrastructure. Sends no input and expects `{""ok"": true}`. If this fails, the server or deployment is likely down." testId="ping" onRun={runPingTest} />
                
                <TestCard title="Echo Input Flow Test (#6)" description="Tests payload transmission. Sends a JSON object and expects the entire object back. If you get `{}`, the pipeline is stripping the payload." testId="echo-input" onRun={runEchoInputTest}>
                     <Input
                        value={echoInputText}
                        onChange={(e) => setEchoInputText(e.target.value)}
                        className="font-mono"
                    />
                </TestCard>

                <TestCard title="Echo Message Flow Test (#7)" description="Tests specific key access. Sends `{'message': '...'}` and expects the message string back. Tests if the flow can correctly access properties on the input object." testId="echo-message" onRun={runEchoMessageTest}>
                    <Input
                        value={echoMessageText}
                        onChange={(e) => setEchoMessageText(e.target.value)}
                        className="font-mono"
                    />
                </TestCard>

                <TestCard title="Static Result Flow Test (#8)" description="Tests output schema handling. Expects a fixed object `{'infotopes': [], 'orchestrators': []}` to confirm the server can correctly structure and return complex types." testId="static-result" onRun={runStaticResultTest} />
            </div>
        </main>
    );
}
