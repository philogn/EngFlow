import './globals.css';
import '@fortawesome/fontawesome-svg-core/styles.css';
import { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
  maximumScale: 5.0,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export const metadata: Metadata = {
  title: 'Language Lab — Study English with YouTube',
  description: 'An interactive YouTube study tool. Follow along with transcripts, translate subtitle lines, look up words, and ask an AI tutor about any video.',
  robots: {
    index: false,
    follow: false,
  },
};

interface RootLayoutProps {
  readonly children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
