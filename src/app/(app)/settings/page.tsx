

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { X, Plus, Palette, LoaderCircle, LogOut, Link as LinkIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useFirestore, useUser, useDoc, useMemoFirebase, useAuth } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { signOut } from 'firebase/auth';
import { getGmailAuthUrl } from '@/ai/flows/gmail-auth-flow';

type Stage = { name: string; color: string; };

type Settings = {
    pipelineStages: Stage[];
    defaultDealSorting: string;
    darkMode: boolean;
    autoApplyConfidenceThreshold: number;
    autoCreateEntities: boolean;
    dealStageAutoMove: boolean;
    amountChange: boolean;
    dateChange: boolean;
    followUpDelay: { prospect: number; negotiation: number; };
    taskExpiryHours: number;
    emailCheckFrequency: string;
    dealInactivityAlertDays: number;
    autoReminderWindow: string;
    businessHours: { start: string; end: string; };
    activeDays: string[];
    emailSignature: string;
    language: string;
    tone: string;
    timezone: string;
};

const defaultSettings: Settings = {
    pipelineStages: [
        { name: 'Prospect', color: 'bg-blue-500' },
        { name: 'Discovery', color: 'bg-sky-500' },
        { name: 'Proposal', color: 'bg-amber-500' },
        { name: 'Negotiation', color: 'bg-orange-500' },
        { name: 'Closed Won', color: 'bg-green-500' },
        { name: 'Closed Lost', color: 'bg-red-500' },
        { name: 'Retention', color: 'bg-purple-500' },
    ],
    defaultDealSorting: 'probability',
    darkMode: false,
    autoApplyConfidenceThreshold: 80,
    autoCreateEntities: true,
    dealStageAutoMove: true,
    amountChange: false,
    dateChange: false,
    followUpDelay: { prospect: 3, negotiation: 5 },
    taskExpiryHours: 48,
    emailCheckFrequency: '6h',
    dealInactivityAlertDays: 10,
    autoReminderWindow: '24h',
    businessHours: { start: '09:00', end: '18:00' },
    activeDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    emailSignature: '',
    language: 'en',
    tone: 'neutral',
    timezone: 'America/New_York',
};

const StageEditor = ({ stages, onStagesChange }: { stages: Stage[], onStagesChange: (stages: Stage[]) => void }) => {
    const [newStage, setNewStage] = useState('');

    const addStage = () => {
        if (newStage.trim() !== '' && !stages.some(s => s.name === newStage)) {
            onStagesChange([...stages, { name: newStage, color: 'bg-gray-400' }]);
            setNewStage('');
        }
    };

    const removeStage = (name: string) => {
        onStagesChange(stages.filter(s => s.name !== name));
    };

    const updateStageName = (oldName: string, newName: string) => {
        onStagesChange(stages.map(s => s.name === oldName ? { ...s, name: newName } : s));
    };

    const updateStageColor = (name: string, color: string) => {
        onStagesChange(stages.map(s => s.name === name ? { ...s, color } : s));
    }

    const colors = ['bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500', 'bg-gray-400'];

    return (
        <div className="space-y-3">
            <Label>Pipeline Stages & Colors</Label>
            <div className="space-y-2">
                {stages.map((stage) => (
                    <div key={stage.name} className="flex items-center gap-2">
                         <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="icon" className="h-6 w-6">
                                     <div className={`h-4 w-4 rounded-full ${stage.color}`} />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2">
                                <div className="grid grid-cols-6 gap-1">
                                    {colors.map(color => (
                                        <button key={color} onClick={() => updateStageColor(stage.name, color)} className={`h-6 w-6 rounded-full ${color} transition-transform hover:scale-110`} />
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Input 
                            value={stage.name} 
                            onChange={(e) => updateStageName(stage.name, e.target.value)}
                            className="h-9"
                        />
                        <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeStage(stage.name)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-2">
                <Input
                    placeholder="New stage name"
                    value={newStage}
                    onChange={(e) => setNewStage(e.target.value)}
                    className="h-9"
                />
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={addStage}>
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}

function GmailIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-8 5.5L4 7z"/>
            <path d="M20 7l-8 5.5L4 7"/>
        </svg>
    )
}

export default function SettingsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const settingsRef = useMemoFirebase(() => 
    firestore && user ? doc(firestore, 'users', user.uid, 'settings', 'user') : null
  , [firestore, user]);

  const { data: savedSettings, isLoading: isLoadingSettings } = useDoc<Settings>(settingsRef);

  useEffect(() => {
    if (savedSettings) {
        setSettings(savedSettings);
    } else if (!isLoadingSettings) {
        setSettings(defaultSettings);
    }
  }, [savedSettings, isLoadingSettings]);

  const handleSettingsChange = <K extends keyof Settings>(key: K, value: Settings[K]) => {
      setSettings(prev => prev ? { ...prev, [key]: value } : null);
  };
  
  const handleNestedChange = <K extends keyof Settings, NK extends keyof Settings[K]>(key: K, nestedKey: NK, value: Settings[K][NK]) => {
    setSettings(prev => prev ? {
        ...prev,
        [key]: {
            ...(prev[key] as object),
            [nestedKey]: value
        }
    } : null);
  };

  const handleSave = async () => {
    if (!settingsRef || !settings) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save settings.' });
        return;
    }
    setIsSaving(true);
    try {
        await setDoc(settingsRef, settings, { merge: true });
        toast({ title: 'Success!', description: 'Your settings have been saved.' });
    } catch (error) {
        console.error("Error saving settings:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'An error occurred while saving your settings.' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleConnectGmail = async () => {
    setIsConnecting(true);
    try {
      // Dynamically create the redirect URI based on the current window's origin
      const redirectUri = `${window.location.origin}/oauth/callback`;
      const { url } = await getGmailAuthUrl({ redirectUri });
      if (url) {
        // Open the Google consent screen in a new window/tab
        window.open(url, '_blank', 'noopener,noreferrer,width=500,height=600');
      } else {
        throw new Error('Could not get authentication URL.');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: error.message || 'Could not initiate connection with Google.'
      });
    } finally {
        // Since we are opening a new window, we may not know when it closes.
        // It's better to reset the connecting state after a short delay
        setTimeout(() => setIsConnecting(false), 3000);
    }
  };

  const handleLogout = async () => {
    if (auth) {
        await signOut(auth);
        router.push('/login');
    }
  };

  if (isLoadingSettings || !settings) {
    return (
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                 <div>
                    <h1 className="text-3xl font-bold tracking-tight font-headline">Settings</h1>
                    <p className="text-muted-foreground">Manage your integrations and application settings.</p>
                </div>
                <Card>
                    <CardHeader><CardTitle><Skeleton className="h-6 w-1/4" /></CardTitle><CardDescription><Skeleton className="h-4 w-1/2" /></CardDescription></CardHeader>
                    <CardContent className="space-y-6">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle><Skeleton className="h-6 w-1/4" /></CardTitle><CardDescription><Skeleton className="h-4 w-1/2" /></CardDescription></CardHeader>
                    <CardContent className="space-y-6">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                </Card>
            </div>
        </main>
    )
  }

  return (
    <>
      <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
              <h1 className="text-3xl font-bold tracking-tight font-headline">Settings</h1>
              <p className="text-muted-foreground">Manage your integrations and application settings.</p>
          </div>
          
          {/* Integrations Card */}
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>Connect your accounts to enable automated workflows.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                        <GmailIcon />
                        <div>
                            <p className="font-medium">Gmail</p>
                            <p className="text-sm text-muted-foreground">Sync emails automatically.</p>
                        </div>
                    </div>
                     <Button onClick={handleConnectGmail} disabled={isConnecting}>
                        {isConnecting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                        Connect
                    </Button>
                </div>
            </CardContent>
          </Card>

          {/* Personalization Card */}
          <Card>
            <CardHeader>
              <CardTitle>Personalization</CardTitle>
              <CardDescription>Customize stages, sorting, and appearance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <StageEditor stages={settings.pipelineStages} onStagesChange={(stages) => handleSettingsChange('pipelineStages', stages)} />
                <div className="flex items-center justify-between">
                    <Label htmlFor="default-sort">Default Deal Sorting</Label>
                    <Select value={settings.defaultDealSorting} onValueChange={(value) => handleSettingsChange('defaultDealSorting', value)}>
                        <SelectTrigger id="default-sort" className="w-[200px]">
                            <SelectValue placeholder="Select sorting" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="probability">Probability</SelectItem>
                            <SelectItem value="amount">Amount</SelectItem>
                            <SelectItem value="stage">Stage</SelectItem>
                            <SelectItem value="last_contact">Last Contact</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="ui-mode">Dark Mode</Label>
                    <Switch id="ui-mode" checked={settings.darkMode} onCheckedChange={(checked) => handleSettingsChange('darkMode', checked)} />
                </div>
            </CardContent>
          </Card>

          {/* Automation and Orchestrator Behavior Card */}
          <Card>
            <CardHeader>
              <CardTitle>Automation & Orchestrator</CardTitle>
              <CardDescription>Define how the AI assistant behaves.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
               <div className="space-y-3">
                    <div className='flex justify-between items-center'>
                         <Label htmlFor="confidence-threshold">Auto-Apply Confidence Threshold</Label>
                         <span className="text-sm font-medium text-muted-foreground">{settings.autoApplyConfidenceThreshold}%</span>
                    </div>
                    <Slider
                        id="confidence-threshold"
                        value={[settings.autoApplyConfidenceThreshold]}
                        onValueChange={(value) => handleSettingsChange('autoApplyConfidenceThreshold', value[0])}
                        max={100}
                        step={5}
                    />
               </div>
               <div className="flex items-center justify-between">
                    <Label htmlFor="auto-create-entities">Auto-Create Entities (Contacts, Companies)</Label>
                    <Switch id="auto-create-entities" checked={settings.autoCreateEntities} onCheckedChange={(checked) => handleSettingsChange('autoCreateEntities', checked)} />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="deal-stage-auto-move">Allow AI to Move Deal Stage</Label>
                    <Switch id="deal-stage-auto-move" checked={settings.dealStageAutoMove} onCheckedChange={(checked) => handleSettingsChange('dealStageAutoMove', checked)} />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="amount-change">Allow AI to Change Deal Amount</Label>
                    <Switch id="amount-change" checked={settings.amountChange} onCheckedChange={(checked) => handleSettingsChange('amountChange', checked)} />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="date-change">Allow AI to Change Close Date & Win/Loss Status</Label>
                    <Switch id="date-change" checked={settings.dateChange} onCheckedChange={(checked) => handleSettingsChange('dateChange', checked)} />
                </div>
            </CardContent>
          </Card>

          {/* Cadence and Follow-up Rules Card */}
          <Card>
            <CardHeader>
              <CardTitle>Cadence & Follow-up Rules</CardTitle>
              <CardDescription>Set rules for reminders and system checks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-3">
                    <Label>Follow-up Delay (per stage)</Label>
                    <div className="grid grid-cols-2 gap-4">
                         <div className='space-y-2'><Label htmlFor='delay-prospect' className='text-xs font-normal'>Prospect</Label><Input id='delay-prospect' type="number" value={settings.followUpDelay.prospect} onChange={(e) => handleNestedChange('followUpDelay', 'prospect', parseInt(e.target.value))} placeholder="Days"/></div>
                         <div className='space-y-2'><Label htmlFor='delay-negotiation' className='text-xs font-normal'>Negotiation</Label><Input id='delay-negotiation' type="number" value={settings.followUpDelay.negotiation} onChange={(e) => handleNestedChange('followUpDelay', 'negotiation', parseInt(e.target.value))} placeholder="Days"/></div>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="task-expiry">Task Expiry (hours after due date)</Label>
                    <Input id="task-expiry" type="number" value={settings.taskExpiryHours} onChange={(e) => handleSettingsChange('taskExpiryHours', parseInt(e.target.value))} className="w-[120px]" />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="email-check-freq">Email Check-in Frequency</Label>
                    <Select value={settings.emailCheckFrequency} onValueChange={(value) => handleSettingsChange('emailCheckFrequency', value)}>
                        <SelectTrigger id="email-check-freq" className="w-[180px]">
                            <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="2h">Every 2 hours</SelectItem>
                            <SelectItem value="6h">Every 6 hours</SelectItem>
                            <SelectItem value="24h">Every 24 hours</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="inactivity-alert">Deal Inactivity Alert (days)</Label>
                    <Input id="inactivity-alert" type="number" value={settings.dealInactivityAlertDays} onChange={(e) => handleSettingsChange('dealInactivityAlertDays', parseInt(e.target.value))} className="w-[120px]" />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="auto-reminder">Auto-Reminder Window (before meeting)</Label>
                     <Select value={settings.autoReminderWindow} onValueChange={(value) => handleSettingsChange('autoReminderWindow', value)}>
                        <SelectTrigger id="auto-reminder" className="w-[180px]">
                            <SelectValue placeholder="Select window" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1h">1 hour before</SelectItem>
                            <SelectItem value="24h">24 hours before</SelectItem>
                            <SelectItem value="48h">48 hours before</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
          </Card>

           {/* Communication Card */}
          <Card>
            <CardHeader>
              <CardTitle>Communication</CardTitle>
              <CardDescription>Manage how the system communicates on your behalf.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-3">
                    <Label>Business Hours</Label>
                    <div className="grid grid-cols-2 gap-4">
                         <div className='space-y-2'><Label htmlFor='business-start' className='text-xs font-normal'>Start</Label><Input id='business-start' type="time" value={settings.businessHours.start} onChange={(e) => handleNestedChange('businessHours', 'start', e.target.value)} /></div>
                         <div className='space-y-2'><Label htmlFor='business-end' className='text-xs font-normal'>End</Label><Input id='business-end' type="time" value={settings.businessHours.end} onChange={(e) => handleNestedChange('businessHours', 'end', e.target.value)} /></div>
                    </div>
                </div>
                 <div className="space-y-3">
                    <Label>Active Days</Label>
                    <div className="flex items-center space-x-4">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                            <div key={day} className="flex items-center gap-2">
                                <Switch 
                                    id={`day-${day}`} 
                                    checked={settings.activeDays.includes(day)} 
                                    onCheckedChange={(checked) => {
                                        const newDays = checked 
                                            ? [...settings.activeDays, day]
                                            : settings.activeDays.filter(d => d !== day);
                                        handleSettingsChange('activeDays', newDays);
                                    }}
                                />
                                <Label htmlFor={`day-${day}`}>{day}</Label>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-3">
                    <Label htmlFor="email-signature">Email Signature</Label>
                    <Textarea id="email-signature" placeholder="Best,\nYour Name" rows={4} value={settings.emailSignature} onChange={(e) => handleSettingsChange('emailSignature', e.target.value)} />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="language">Language / Locale</Label>
                    <Select value={settings.language} onValueChange={(value) => handleSettingsChange('language', value)}>
                        <SelectTrigger id="language" className="w-[180px]">
                            <SelectValue placeholder="Select language" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="en">English (US)</SelectItem>
                            <SelectItem value="es">Español</SelectItem>
                            <SelectItem value="pt">Português</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="tone">AI Tone of Communication</Label>
                    <Select value={settings.tone} onValueChange={(value) => handleSettingsChange('tone', value)}>
                        <SelectTrigger id="tone" className="w-[180px]">
                            <SelectValue placeholder="Select tone" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="formal">Formal</SelectItem>
                            <SelectItem value="neutral">Neutral</SelectItem>
                            <SelectItem value="friendly">Friendly</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="flex items-center justify-between">
                    <Label htmlFor="timezone">Time Zone</Label>
                    <Select value={settings.timezone} onValueChange={(value) => handleSettingsChange('timezone', value)}>
                        <SelectTrigger id="timezone" className="w-[240px]">
                            <SelectValue placeholder="Select time zone" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                            <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                            <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                            <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
            <CardFooter>
                <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                    Save All Settings
                </Button>
            </CardFooter>
          </Card>

          <Card className="border-destructive">
            <CardContent className="p-6 flex justify-center">
                <Button variant="destructive" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Log Out
                </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
