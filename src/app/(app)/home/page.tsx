import { InfoshardProcessor } from '@/components/infoshard-processor';
import { RecentActivity } from '@/components/recent-activity';
import { UpcomingTasks } from '@/components/upcoming-tasks';

export default function HomePage() {
  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-6 font-headline">
          Home Dashboard
        </h1>
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <div className="xl:col-span-2">
                <InfoshardProcessor />
            </div>
            <div className="space-y-6">
                <RecentActivity />
                <UpcomingTasks />
            </div>
        </div>
      </div>
    </main>
  );
}
