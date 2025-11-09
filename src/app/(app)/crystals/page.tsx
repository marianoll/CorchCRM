'use client';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, orderBy, query, type Firestore } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Gem } from 'lucide-react';

type Crystal = {
    id: string;
    fact: string;
    source: string;
    sourceIdentifier: string;
    status: 'active' | 'overwritten';
    createdAt: string;
};

const statusVariant: { [key: string]: 'default' | 'secondary' | 'destructive' } = {
  active: 'default',
  overwritten: 'destructive',
};

export default function CrystalsPage() {
    const firestore = useFirestore();
    const { user } = useUser();

    const crystalsQuery = useMemoFirebase(() => 
        firestore && user
        ? query(collection(firestore as Firestore, 'crystals'), orderBy('createdAt', 'desc')) 
        : null, 
    [firestore, user]);

    const { data: crystals, isLoading: crystalsLoading } = useCollection<Crystal>(crystalsQuery);

  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
            <Gem className="h-7 w-7" />
            Crystals Log
          </h1>
          <p className="text-muted-foreground">An immutable audit trail of all atomized facts extracted by the AI.</p>
        </div>
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Timestamp</TableHead>
                <TableHead>Fact</TableHead>
                <TableHead className="w-[150px]">Source</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {crystalsLoading && <TableRow><TableCell colSpan={4} className="text-center">Loading crystals...</TableCell></TableRow>}
              {!crystalsLoading && crystals?.length === 0 && <TableRow><TableCell colSpan={4} className="text-center">No crystals found.</TableCell></TableRow>}
              {crystals?.map((crystal) => (
                <TableRow key={crystal.id}>
                  <TableCell>{format(new Date(crystal.createdAt), "MMM d, yyyy, h:mm a")}</TableCell>
                  <TableCell className="font-medium">{crystal.fact}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{crystal.source}</Badge>
                  </TableCell>
                   <TableCell>
                    <Badge variant={statusVariant[crystal.status] || 'secondary'}>{crystal.status}</Badge>
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
