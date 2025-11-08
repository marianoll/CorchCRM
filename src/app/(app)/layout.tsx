'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PlaceHolderImages } from '@/lib/placeholder-images';
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
import {
  Home,
  Inbox,
  Briefcase,
  Search,
  Settings,
  ChevronDown,
  Gem,
} from 'lucide-react';
import {
  FirebaseClientProvider,
  initializeFirebase,
} from '@/firebase';

const navItems = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/crystals', label: 'Crystals', icon: Gem },
  { href: '/inbox', label: 'Zero-Click Inbox', icon: Inbox },
  { href: '/crm', label: 'CRM View', icon: Briefcase },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/settings', label: 'Settings', icon: Settings },
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

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar');
  const firebaseApp = initializeFirebase();

  return (
    <FirebaseClientProvider firebaseApp={firebaseApp}>
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
            <SidebarMenuButton size="lg" className="h-auto w-full justify-start p-2 group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:w-12 group-data-[collapsible=icon]:justify-center">
              {userAvatar && (
                  <Avatar className="h-8 w-8">
                  <AvatarImage src={userAvatar.imageUrl} alt={userAvatar.description} data-ai-hint={userAvatar.imageHint} />
                  <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
              )}
              <div className="flex flex-col items-start truncate group-data-[collapsible=icon]:hidden">
                <span className="font-medium">Admin User</span>
                <span className="text-xs text-muted-foreground">admin@corchcrm.com</span>
              </div>
              <ChevronDown className="ml-auto group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
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
    </FirebaseClientProvider>
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
