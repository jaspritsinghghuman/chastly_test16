import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Toaster } from '@/components/ui/sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'BeeCastly - AI-Powered Omnichannel Marketing Platform',
  description: 'Automate your sales and marketing with AI-powered omnichannel messaging, voice calls, and workflow automation.',
  keywords: ['marketing automation', 'CRM', 'WhatsApp', 'SMS', 'email marketing', 'AI', 'workflows'],
  authors: [{ name: 'BeeCastly' }],
  openGraph: {
    title: 'BeeCastly - AI-Powered Omnichannel Marketing Platform',
    description: 'Automate your sales and marketing with AI-powered omnichannel messaging.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
