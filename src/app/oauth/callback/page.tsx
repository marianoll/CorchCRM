
'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { processGmailAuthCode } from '@/ai/flows/gmail-auth-flow';
import { useUser } from '@/firebase/auth/use-user';
import { LoaderCircle } from 'lucide-react';

function AuthCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Authentication Failed',
        description: 'Google authorization was denied or failed.',
      });
      // Close the popup window
      if (window.opener) {
        window.close();
      } else {
        router.replace('/settings');
      }
      return;
    }

    if (code && user) {
      // Get the redirect URI from when the auth process was started
      const originalRedirectUri = `${window.location.origin}/oauth/callback`;
      
      processGmailAuthCode({ code, userId: user.uid, redirectUri: originalRedirectUri })
        .then(result => {
          if (result.success) {
            toast({
              title: 'Success!',
              description: result.message,
            });
            // You can optionally refresh the opener window if it exists
            if (window.opener) {
              window.opener.location.reload();
            }
          } else {
            throw new Error(result.message);
          }
        })
        .catch(err => {
          toast({
            variant: 'destructive',
            title: 'Connection Error',
            description: err.message || 'Failed to finalize connection with Google.',
          });
        })
        .finally(() => {
          // Close the popup window
          if (window.opener) {
            window.close();
          } else {
            router.replace('/settings');
          }
        });
    }

  }, [searchParams, router, toast, user]);

  // Don't run the effect until the user is loaded
  if (isUserLoading) {
    return (
        <div className="flex h-screen w-full items-center justify-center flex-col gap-4">
            <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Waiting for user session...</p>
        </div>
    );
  }

  // If there's no code and no error, or user is not available yet
  return (
    <div className="flex h-screen w-full items-center justify-center flex-col gap-4">
        <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Finalizing connection...</p>
    </div>
  );
}


export default function OauthCallbackPage() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AuthCallback />
        </Suspense>
    )
}
