
'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { X, Plus, Palette } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const StageEditor = () => {
    const [stages, setStages] = useState([
        { name: 'Prospect', color: 'bg-blue-500' },
        { name: 'Discovery', color: 'bg-sky-500' },
        { name: 'Proposal', color: 'bg-amber-500' },
        { name: 'Negotiation', color: 'bg-orange-500' },
        { name: 'Closed Won', color: 'bg-green-500' },
        { name: 'Closed Lost', color: 'bg-red-500' },
        { name: 'Retention', color: 'bg-purple-500' },
    ]);
    const [newStage, setNewStage] = useState('');

    const addStage = () => {
        if (newStage.trim() !== '' && !stages.some(s => s.name === newStage)) {
            setStages([...stages, { name: newStage, color: 'bg-gray-400' }]);
            setNewStage('');
        }
    };

    const removeStage = (name: string) => {
        setStages(stages.filter(s => s.name !== name));
    };

    const updateStageColor = (name: string, color: string) => {
        setStages(stages.map(s => s.name === name ? { ...s, color } : s));
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
                        <Input value={stage.name} className="h-9" readOnly />
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

export default function SettingsPage() {
  const [confidence, setConfidence] = useState(80);

  return (
    <>
      <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
              <h1 className="text-3xl font-bold tracking-tight font-headline">Settings</h1>
              <p className="text-muted-foreground">Manage your integrations and application settings.</p>
          </div>

          {/* Personalization Card */}
          <Card>
            <CardHeader>
              <CardTitle>Personalization</CardTitle>
              <CardDescription>Customize stages, sorting, and appearance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <StageEditor />
                <div className="flex items-center justify-between">
                    <Label htmlFor="default-sort">Default Deal Sorting</Label>
                    <Select defaultValue="probability">
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
                    <Switch id="ui-mode" />
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
                         <span className="text-sm font-medium text-muted-foreground">{confidence}%</span>
                    </div>
                    <Slider
                        id="confidence-threshold"
                        defaultValue={[confidence]}
                        onValueChange={(value) => setConfidence(value[0])}
                        max={100}
                        step={5}
                    />
               </div>
               <div className="flex items-center justify-between">
                    <Label htmlFor="auto-create-entities">Auto-Create Entities (Contacts, Companies)</Label>
                    <Switch id="auto-create-entities" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="deal-stage-auto-move">Allow AI to Move Deal Stage</Label>
                    <Switch id="deal-stage-auto-move" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="amount-change">Allow AI to Change Deal Amount</Label>
                    <Switch id="amount-change" />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="date-change">Allow AI to Change Close Date & Win/Loss Status</Label>
                    <Switch id="date-change" />
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
                         <div className='space-y-2'><Label htmlFor='delay-prospect' className='text-xs font-normal'>Prospect</Label><Input id='delay-prospect' type="number" defaultValue={3} placeholder="Days"/></div>
                         <div className='space-y-2'><Label htmlFor='delay-negotiation' className='text-xs font-normal'>Negotiation</Label><Input id='delay-negotiation' type="number" defaultValue={5} placeholder="Days"/></div>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="task-expiry">Task Expiry (hours after due date)</Label>
                    <Input id="task-expiry" type="number" defaultValue={48} className="w-[120px]" />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="email-check-freq">Email Check-in Frequency</Label>
                    <Select defaultValue="6h">
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
                    <Input id="inactivity-alert" type="number" defaultValue={10} className="w-[120px]" />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="auto-reminder">Auto-Reminder Window (before meeting)</Label>
                     <Select defaultValue="24h">
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
                         <div className='space-y-2'><Label htmlFor='business-start' className='text-xs font-normal'>Start</Label><Input id='business-start' type="time" defaultValue="09:00"/></div>
                         <div className='space-y-2'><Label htmlFor='business-end' className='text-xs font-normal'>End</Label><Input id='business-end' type="time" defaultValue="18:00"/></div>
                    </div>
                </div>
                 <div className="space-y-3">
                    <Label>Active Days</Label>
                    <div className="flex items-center space-x-4">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                            <div key={day} className="flex items-center gap-2">
                                <Switch id={`day-${day}`} defaultChecked={!['Sat', 'Sun'].includes(day)} />
                                <Label htmlFor={`day-${day}`}>{day}</Label>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-3">
                    <Label htmlFor="email-signature">Email Signature</Label>
                    <Textarea id="email-signature" placeholder="Best,\nYour Name" rows={4} />
                </div>
                <div className="flex items-center justify-between">
                    <Label htmlFor="language">Language / Locale</Label>
                    <Select defaultValue="en">
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
                    <Select defaultValue="neutral">
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
                    <Select defaultValue="America/New_York">
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
                <Button>Save All Settings</Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    </>
  );
}

    