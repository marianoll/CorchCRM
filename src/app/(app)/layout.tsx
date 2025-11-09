'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Logo } from '@/components/logo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SearchChatbot } from '@/components/search-chatbot';
import {
  Home,
  Briefcase,
  Settings,
  Mail,
  Upload,
  Bot,
} from 'lucide-react';
import { useUser } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { db } from '@/firebase/client';
import { collection, query } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { LoaderCircle } from 'lucide-react';
import { auth } from '@/firebase/client';

const navItems = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/crm', label: 'CRM View', icon: Briefcase },
  { href: '/email-history', label: 'Email History', icon: Mail },
  { href: '/upload-history', label: 'Upload History', icon: Upload },
  { href: '/orquestrator', label: 'Orquestrator', icon: Bot },
];

function MainNav() {
  const pathname = usePathname();

  return (
      <SidebarMenu>
        {navItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={pathname === item.href}
              tooltip={item.label}
            >
              <Link href={item.href}>
                <item.icon />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
  );
}

function UserProfile() {
    const { user, isUserLoading } = useUser();
    const pathname = usePathname();
    
    if (isUserLoading) {
        return (
             <div className="flex items-center gap-3 w-full p-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex flex-col gap-1 w-full group-data-[collapsible=icon]:hidden">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                </div>
            </div>
        )
    }

    return (
        <SidebarMenuButton
          asChild
          size="lg"
          className="h-auto w-full justify-start p-2 group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:w-12 group-data-[collapsible=icon]:justify-center"
          isActive={pathname === '/settings'}
          tooltip="Settings"
        >
            <Link href="/settings">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || 'User'} />
                    <AvatarFallback>{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start truncate group-data-[collapsible=icon]:hidden">
                    <span className="font-medium">{user?.displayName}</span>
                    <span className="text-sm text-muted-foreground">{user?.email}</span>
                </div>
            </Link>
        </SidebarMenuButton>
    )
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const { user, isUserLoading } = useUser();
    const router = useRouter();

    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Types for CRM data
    type Company = { id: string; name: string; [key: string]: any; };
    type Contact = { id: string; full_name: string; [key: string]: any; };
    type Deal = { id: string; title: string; [key: string]: any; };

    // Fetch all CRM data needed for the search context
    const contactsQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'contacts')) : null, [user]);
    const { data: contacts } = useCollection<Contact>(contactsQuery);
    
    const dealsQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'deals')) : null, [user]);
    const { data: deals } = useCollection<Deal>(dealsQuery);

    const companiesQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'companies')) : null, [user]);
    const { data: companies } = useCollection<Company>(companiesQuery);


    React.useEffect(() => {
        if (!isUserLoading && !user) {
            router.replace('/login');
        }
    }, [user, isUserLoading, router]);

    if (isUserLoading || !user) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <SidebarProvider>
            <Sidebar collapsible="icon" className="bg-card border-r">
                <SidebarHeader className="border-b">
                    <div className="flex w-full items-center justify-between p-2">
                    <Logo />
                    <SidebarTrigger className="hidden md:flex" />
                    </div>
                </SidebarHeader>
                <SidebarContent>
                    <MainNav />
                </SidebarContent>
                <SidebarFooter className="p-2 border-t mt-auto">
                    <UserProfile />
                </SidebarFooter>
            </Sidebar>
            <SidebarInset>
                <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-background px-4 sm:px-6 md:hidden">
                    <SidebarTrigger>
                    <PanelLeftOpenIcon />
                    </SidebarTrigger>
                    <Logo />
                </header>
                {children}

                <div className="fixed bottom-6 right-6 z-50">
                    <Button
                        size="icon"
                        className="rounded-full w-14 h-14 shadow-lg"
                        onClick={() => setIsSearchOpen(true)}
                    >
                        <Bot className="h-6 w-6" />
                        <span className="sr-only">Open Search Chat</span>
                    </Button>
                </div>
                 <SearchChatbot 
                    open={isSearchOpen} 
                    onOpenChange={setIsSearchOpen}
                    contacts={contacts}
                    deals={deals}
                    companies={companies}
                />
            </SidebarInset>
        </SidebarProvider>
    );
}


export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
      <ProtectedLayout>
        {children}
      </ProtectedLayout>
  );
}

function PanelLeftOpenIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M9 3v18" />
        <path d="m14 9 3 3-3 3" />
      </svg>
    )
  }
