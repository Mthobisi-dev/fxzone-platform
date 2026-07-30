import './globals.css';
import { ClientInitializer } from '@/components/layout/ClientInitializer';
import { ColorBendsBackground } from '@/components/ui/ColorBendsBackground';
import { Metadata } from 'next';

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
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="antialiased min-h-screen bg-zinc-950 relative overflow-x-hidden text-zinc-100">
        {/* Dynamic Shader Background */}
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
