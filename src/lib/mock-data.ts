export type Contact = {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  avatar: string;
};

export type Deal = {
  id: string;
  name: string;
  contact: string;
  amount: number;
  stage: 'lead' | 'contacted' | 'proposal' | 'negotiation' | 'won' | 'lost';
  closeDate: string;
};

export type Task = {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
};

export type Suggestion = {
  id: string;
  type: 'New Contact' | 'Deal Update' | 'New Task';
  details: string;
  source: string;
  raw: Record<string, any>;
};

export const contactData: Contact[] = [
  { id: 'c1', name: 'Elena Rodriguez', email: 'elena.r@example.com', company: 'Innovate Corp', phone: '+1 234 567 890', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d' },
  { id: 'c2', name: 'Javier Gomez', email: 'javier.g@example.com', company: 'Tech Solutions', phone: '+1 345 678 901', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026705d' },
  { id: 'c3', name: 'Sofia Fernandez', email: 'sofia.f@example.com', company: 'Future Systems', phone: '+1 456 789 012', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026706d' },
  { id: 'c4', name: 'Carlos Martinez', email: 'carlos.m@example.com', company: 'Data Dynamics', phone: '+1 567 890 123', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026707d' },
];

export const dealData: Deal[] = [
  { id: 'd1', name: 'Innovate Corp Website Redesign', contact: 'Elena Rodriguez', amount: 25000, stage: 'proposal', closeDate: '2024-08-15' },
  { id: 'd2', name: 'Tech Solutions Cloud Migration', contact: 'Javier Gomez', amount: 45000, stage: 'negotiation', closeDate: '2024-07-30' },
  { id: 'd3', name: 'Future Systems AI Integration', contact: 'Sofia Fernandez', amount: 60000, stage: 'won', closeDate: '2024-06-20' },
  { id: 'd4', name: 'Data Dynamics Analytics Platform', contact: 'Carlos Martinez', amount: 35000, stage: 'contacted', closeDate: '2024-09-01' },
  { id: 'd5', name: 'New Client Onboarding', contact: 'Maria Garcia', amount: 15000, stage: 'lead', closeDate: '2024-08-25' },
];

export const taskData: Task[] = [
  { id: 't1', title: 'Follow up with Elena Rodriguez', dueDate: '2024-07-25', completed: false },
  { id: 't2', title: 'Send proposal to Tech Solutions', dueDate: '2024-07-22', completed: false },
  { id: 't3', title: 'Prepare kickoff meeting for Future Systems', dueDate: '2024-07-28', completed: true },
  { id: 't4', title: 'Schedule demo for Data Dynamics', dueDate: '2024-08-02', completed: false },
];

export const suggestionData: Suggestion[] = [
    { 
        id: 's1', 
        type: 'New Contact', 
        details: 'Name: Ana Torres, Email: ana.torres@email.com', 
        source: 'Email from "Project Alpha Kickoff"',
        raw: { name: 'Ana Torres', email: 'ana.torres@email.com' }
    },
    { 
        id: 's2', 
        type: 'Deal Update', 
        details: 'Deal: "Innovate Corp Website Redesign", Stage: "Negotiation"', 
        source: 'Voice Note 2024-07-20',
        raw: { dealId: 'd1', stage: 'negotiation' }
    },
    { 
        id: 's3', 
        type: 'New Task', 
        details: 'Task: "Send updated quote to Javier Gomez by Friday"', 
        source: 'Email from "Re: Cloud Migration"',
        raw: { title: 'Send updated quote to Javier Gomez', dueDate: '2024-07-26' }
    },
];

export const recentActivityData = [
  { id: 'a1', description: 'Email from Elena Rodriguez processed.', time: '2 hours ago', icon: 'Mail' },
  { id: 'a2', description: 'Voice note "Follow-up with Tech Solutions" transcribed.', time: '5 hours ago', icon: 'Mic' },
  { id: 'a3', description: 'New deal "Data Dynamics Analytics Platform" created.', time: '1 day ago', icon: 'Briefcase' },
  { id: 'a4', description: 'Contact Sofia Fernandez updated.', time: '2 days ago', icon: 'User' },
];
