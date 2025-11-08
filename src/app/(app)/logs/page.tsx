import { logData, type Log } from '@/lib/mock-data';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

const eventTypeVariant: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
  'Voice Input': 'default',
  'Email Parsed': 'default',
  'Contact Created': 'secondary',
  'Deal Updated': 'secondary',
  'Task Assigned': 'secondary',
};

export default function LogsPage() {
  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight font-headline">Event Logs</h1>
          <p className="text-muted-foreground">An immutable audit trail of all system and user actions.</p>
        </div>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead className="w-[150px]">Event Type</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Key Info</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logData.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{format(new Date(log.timestamp), "MMM d, yyyy, h:mm a")}</TableCell>
                  <TableCell>
                    <Badge variant={eventTypeVariant[log.eventType] || 'secondary'}>{log.eventType}</Badge>
                  </TableCell>
                  <TableCell>{log.client}</TableCell>
                  <TableCell className="font-medium">{log.description}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {log.keyInfo.map((info, index) => (
                        <Badge key={index} variant="outline">{info}</Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
