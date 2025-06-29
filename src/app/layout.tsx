import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Smartlyte AI - Learn Essential Skills with AI Guidance',
  description: 'AI-powered learning assistant for digital, financial, and health skills. Get personalized guidance from specialized AI assistants.',
  keywords: [
    'AI learning',
    'digital skills',
    'financial literacy', 
    'health education',
    'AI assistant',
    'educational technology',
  ],
  authors: [{ name: 'Smartlyte Team' }],
  creator: 'Smartlyte Team',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    title: 'Smartlyte AI - Learn Essential Skills with AI Guidance',
    description: 'AI-powered learning assistant for digital, financial, and health skills.',
    siteName: 'Smartlyte AI',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Smartlyte AI - Learn Essential Skills with AI Guidance',
    description: 'AI-powered learning assistant for digital, financial, and health skills.',
    creator: '@smartlyte',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </head>
        <body className={inter.className} suppressHydrationWarning>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}