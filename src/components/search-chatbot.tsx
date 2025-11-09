'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { LoaderCircle, Bot, Send, Sparkles, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { naturalLanguageSearch, type NaturalLanguageSearchOutput } from '@/ai/flows/natural-language-search';
import ReactMarkdown from 'react-markdown';
import { Avatar, AvatarFallback } from './ui/avatar';
import { cn } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

type CrmData = {
  contacts: any[] | null;
  deals: any[] | null;
  companies: any[] | null;
}

type SearchChatbotProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & CrmData;

type TableData = {
    headers: string[];
    rows: any[][];
};

type Message = {
    role: 'user' | 'assistant';
    content: string | TableData;
};

const inspirationChips = [
    "Deals without reply in the last 10 days",
    "Top deals above €20,000 closing this month",
    "Companies with more than 200 employees",
    "Contacts with job title = CTO",
    "All emails tagged as important or follow-up",
    "Average deal size by industry",
];

function AssistantMessage({ content }: { content: string | TableData }) {
    if (typeof content === 'string') {
        return (
            <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none">
                {content}
            </ReactMarkdown>
        );
    }
    
    if (typeof content === 'object' && content.headers && content.rows) {
        return (
            <div className="overflow-x-auto">
                <Table className="min-w-full">
                    <TableHeader>
                        <TableRow>
                            {content.headers.map((header, i) => (
                                <TableHead key={i}>{header}</TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {content.rows.map((row, i) => (
                            <TableRow key={i}>
                                {row.map((cell, j) => (
                                    <TableCell key={j}>{String(cell)}</TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        );
    }

    return null;
}


export function SearchChatbot({ open, onOpenChange, contacts, deals, companies }: SearchChatbotProps) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({
            top: scrollAreaRef.current.scrollHeight,
            behavior: 'smooth'
        });
    }
  }, [messages, isPending])

  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      toast({
        variant: 'destructive',
        title: 'Query is empty',
        description: 'Please enter a search query.',
      });
      return;
    }

    setMessages(prev => [...prev, { role: 'user', content: searchQuery }]);
    setQuery('');

    startTransition(async () => {
      try {
        const res = await naturalLanguageSearch({ 
            query: searchQuery,
            contacts: contacts || [],
            deals: deals || [],
            companies: companies || []
        });
        setMessages(prev => [...prev, { role: 'assistant', content: res.response }]);
      } catch (error: any) {
        console.error(error);
        const errorMessage = "Sorry, I couldn't perform that search. Please try again.";
        setMessages(prev => [...prev, { role: 'assistant', content: errorMessage }]);
        toast({
          variant: 'destructive',
          title: 'Search Failed',
          description: error.message || 'There was a problem with your search.',
        });
      }
    });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setQuery('');
      setMessages([]);
    }
    onOpenChange(isOpen);
  };
  
  const handleNewConversation = () => {
    setMessages([]);
    setQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl flex flex-col h-[70vh]">
        <DialogHeader>
          <div className="flex justify-between items-center">
            <DialogTitle className="flex items-center gap-2">
              <Bot />
              Natural Language Search
            </DialogTitle>
            {messages.length > 0 && (
                <Button variant="ghost" size="icon" onClick={handleNewConversation}>
                    <RefreshCw className="h-4 w-4" />
                    <span className="sr-only">New Conversation</span>
                </Button>
            )}
          </div>
          <DialogDescription>
            Ask a question about your CRM data in plain English. The AI will interpret your query.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 space-y-4 py-4 pr-4 -mr-4" ref={scrollAreaRef}>
            <div className="space-y-4">
            {messages.length === 0 && !isPending && (
                 <div className="p-4">
                    <p className="text-sm font-medium mb-2 text-muted-foreground">Try asking me something like...</p>
                    <div className="flex flex-wrap gap-2">
                        {inspirationChips.map((chip, i) => (
                            <Button key={i} variant="outline" size="sm" onClick={() => handleSearch(chip)}>
                                {chip}
                            </Button>
                        ))}
                    </div>
                </div>
            )}
            {messages.map((message, index) => (
              <div key={index} className={cn("flex items-start gap-3", message.role === 'user' && "justify-end")}>
                {message.role === 'assistant' && (
                  <Avatar className="w-8 h-8 border">
                    <AvatarFallback><Sparkles className="h-4 w-4" /></AvatarFallback>
                  </Avatar>
                )}
                <div className={cn("rounded-lg px-3 py-2 max-w-full overflow-x-auto", message.role === 'user' ? "bg-primary text-primary-foreground" : "bg-muted")}>
                   {message.role === 'user' ? (
                       <p>{message.content}</p>
                   ) : (
                       <AssistantMessage content={message.content} />
                   )}
                </div>
              </div>
            ))}
            {isPending && (
                <div className="flex items-start gap-3">
                    <Avatar className="w-8 h-8 border">
                        <AvatarFallback><Sparkles className="h-4 w-4" /></AvatarFallback>
                    </Avatar>
                    <div className="rounded-lg px-3 py-2 bg-muted flex items-center">
                        <LoaderCircle className="h-5 w-5 animate-spin" />
                    </div>
                </div>
            )}
            </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4">
          <div className="flex w-full items-center space-x-2">
            <Input
              type="text"
              placeholder="e.g., 'deals over 50k for Acme Corp'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
              disabled={isPending}
              className="text-base"
            />
            <Button onClick={() => handleSearch(query)} disabled={isPending || !query} size="icon">
                <Send className="h-4 w-4" />
              <span className="sr-only">Search</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
