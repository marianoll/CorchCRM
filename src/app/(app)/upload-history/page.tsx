'use client';

import { useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useUser } from '@/firebase/auth/use-user';
import { db } from '@/firebase/client';
import { collection, orderBy, query, Timestamp } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type Upload = {
    id: string;
    createdAt: string | Timestamp;
    source: 'note' | 'file';
    content: string;
    fileName?: string;
};

const sourceVariant: { [key: string]: 'default' | 'secondary' } = {
  note: 'default',
  file: 'secondary',
};

const toDate = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    if (dateValue instanceof Timestamp) return dateValue.toDate();
    if (typeof dateValue === 'string') return new Date(dateValue);
    if (dateValue && typeof dateValue.seconds === 'number') {
        return new Date(dateValue.seconds * 1000);
    }
    return new Date();
};


export default function UploadHistoryPage() {
    const { user } = useUser();
    
    const uploadsQuery = useMemo(() => user ? query(collection(db, 'users', user.uid, 'uploads'), orderBy('createdAt', 'desc')) : null, [user]);
    const { data: uploads, loading: uploadsLoading } = useCollection<Upload>(uploadsQuery);
    
  return (
    <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
                    <Upload className="h-7 w-7" />
                    Upload History
                </h1>
                <p className="text-muted-foreground">A log of all text inputs from notes and files.</p>
            </div>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Upload Logs</CardTitle>
                <CardDescription>All text captured by Note-to-CRM and File-to-CRM appears here.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[180px]">Timestamp</TableHead>
                        <TableHead className="w-[120px]">Source</TableHead>
                        <TableHead>Content</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {uploadsLoading && <TableRow><TableCell colSpan={3} className="text-center">Loading uploads...</TableCell></TableRow>}
                    {!uploadsLoading && uploads?.length === 0 && <TableRow><TableCell colSpan={3} className="text-center">No uploads found.</TableCell></TableRow>}
                    {uploads?.map((upload) => (
                        <TableRow key={upload.id}>
                            <TableCell>{upload.createdAt ? format(toDate(upload.createdAt), "MMM d, yyyy, h:mm a") : 'No date'}</TableCell>
                            <TableCell>
                                <Badge variant={sourceVariant[upload.source]}>{upload.source}</Badge>
                                {upload.fileName && <p className="text-xs text-muted-foreground truncate">{upload.fileName}</p>}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <p className="truncate cursor-pointer">{upload.content}</p>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-2xl">
                                        <DialogHeader>
                                            <DialogTitle>Full Content</DialogTitle>
                                            <DialogDescription>
                                                Source: {upload.source} {upload.fileName ? `(${upload.fileName})` : ''}
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="prose prose-sm dark:prose-invert max-h-[60vh] overflow-y-auto whitespace-pre-wrap">
                                            {upload.content}
                                        </div>
                                        <DialogFooter>
                                            <Button type="button" variant="secondary">Close</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                </Table>
            </CardContent>
        </Card>
      </div>
    </main>
  );
}

    