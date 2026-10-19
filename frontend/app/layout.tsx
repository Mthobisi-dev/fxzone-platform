import './globals.css';
import { ClientInitializer } from '@/components/layout/ClientInitializer';
import { ColorBendsBackground } from '@/components/ui/ColorBendsBackground';
import { Metadata } from 'next';
import { Inter, JetBrains_Mono, Manrope } from 'next/font/google';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-data',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'FxZone | AI-Powered Trading Intelligence Platform',
  description: 'Real-time financial market data, AI assistant, personalized news, social trading network, and WebRTC live sessions.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased min-h-screen bg-[var(--color-background)] relative overflow-x-hidden text-[var(--color-text)]">
        {/* Lightweight background keeps navigation and scrolling responsive. */}
        <ColorBendsBackground />

        {/* Foreground Content */}
        <div className="relative z-10 min-h-screen">
          <ClientInitializer />
          {children}
        </div>
      </body>
    </html>
  );
}
