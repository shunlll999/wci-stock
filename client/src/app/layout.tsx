import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Stock Signal Playground', description: 'AI assessment coordinates' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
