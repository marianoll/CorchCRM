import React from 'react';
import Image from 'next/image';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 font-headline text-lg font-bold ${className}`}>
        <Image src="/icon.png" alt="CorchCRM logo" width="24" height="24" />
      <span>CorchCRM</span>
    </div>
  );
}
