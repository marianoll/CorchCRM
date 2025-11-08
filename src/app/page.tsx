import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import Image from 'next/image';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="p-4 sm:p-6">
        <Logo />
      </header>
      <main className="flex-1">
        <section className="container mx-auto px-4 py-16 sm:py-24 text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tighter mb-4 font-headline">
              The Zero-Click CRM You've Always Wanted
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-8">
              CorchCRM automatically transforms voice, emails, and meetings into structured data, allowing you to focus on what truly matters: your customers.
            </p>
            <Button asChild size="lg">
              <Link href="/home">Enter App</Link>
            </Button>
          </div>
        </section>

        <section className="container mx-auto px-4 pb-16 sm:pb-24">
            <div className="relative aspect-video overflow-hidden rounded-2xl border bg-card shadow-lg">
                <Image 
                    src="https://picsum.photos/seed/crm-dashboard/1280/720"
                    alt="CorchCRM Dashboard Screenshot"
                    fill
                    className="object-cover"
                    data-ai-hint="dashboard analytics"
                />
            </div>
        </section>
      </main>
      <footer className="p-4 sm:p-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} CorchCRM. All rights reserved.
      </footer>
    </div>
  );
}
