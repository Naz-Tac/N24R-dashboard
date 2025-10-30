import { Outfit } from 'next/font/google';
import './globals.css';

import { SidebarProvider } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';
import Notifications from '@/components/Notifications';
import AssistantButton from '@/components/AssistantButton';

const outfit = Outfit({
  subsets: ["latin"],
});

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${outfit.className} dark:bg-gray-900`}>
        <ThemeProvider>
          <SidebarProvider>
            {children}
            <Notifications />
            <AssistantButton />
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
