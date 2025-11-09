
'use client';

import React from 'react';
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
  SidebarGroup,
  SidebarGroupLabel,
} from '@/components/ui/sidebar';
import { Logo } from '@/components/logo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Home,
  Inbox,
  Briefcase,
  Settings,
  ChevronDown,
  Gem,
  History,
  Mail,
  Bug,
} from 'lucide-react';
import {
  useUser,
} from '@/firebase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from '@/components/ui/skeleton';


const navItems = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/inbox', label: 'Zero-Click Inbox', icon: Inbox },
  { href: '/crm', label: 'CRM View', icon: Briefcase },
];

function MainNav() {
  const pathname = usePathname();

  return (
    <>
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
      <SidebarGroup className='mt-auto pt-4 border-t'>
         <SidebarGroupLabel className='text-muted-foreground'>
            <Bug />
            <span>Debugging</span>
        </SidebarGroupLabel>
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/email-history'} className="text-muted-foreground">
                    <Link href="/email-history"><Mail /><span>Email History</span></Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/changes-history'} className="text-muted-foreground">
                    <Link href="/changes-history"><History /><span>Changes History</span></Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === '/crystals'} className="text-muted-foreground">
                    <Link href="/crystals"><Gem /><span>Crystals</span></Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </>
  );
}

function UserProfile() {
    const { user, isUserLoading } = useUser();
    
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
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="h-auto w-full justify-start p-2 group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:w-12 group-data-[collapsible=icon]:justify-center">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || 'User'} />
                        <AvatarFallback>{user?.displayName?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start truncate group-data-[collapsible=icon]:hidden">
                        <span className="font-medium">{user?.displayName}</span>
                        <span className="text-sm text-muted-foreground">{user?.email}</span>
                    </div>
                    <ChevronDown className="ml-auto group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 mb-2" side="top" align="start">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                 <DropdownMenuItem asChild>
                    <Link href="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Settings</span>
                    </Link>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const { user, isUserLoading } = useUser();
    const router = useRouter();

    React.useEffect(() => {
        // If loading is finished and there's no user, redirect to login.
        if (!isUserLoading && !user) {
            router.replace('/login');
        }
    }, [user, isUserLoading, router]);

    // While loading, we can show a loader or null
    if (isUserLoading || !user) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }
    
    // If user is loaded and present, render the layout
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
                <SidebarFooter className="p-2 border-t">
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
