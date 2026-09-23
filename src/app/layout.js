import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/Toast';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'SpareHub — Quality Bike Spare Parts',
  description:
    'Your trusted bike parts partner. Quality spare parts for Hero, Bajaj, Honda, TVS, Royal Enfield, Yamaha and more. Search by part number, bike model, or part name.',
  keywords: 'bike spare parts, motorcycle parts, Hero Splendor parts, Bajaj Pulsar parts, Honda Activa parts',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <AuthProvider>
          <ToastProvider>
            <Navbar />
            <main style={{ minHeight: '100vh', paddingTop: 'var(--header-height)' }}>
              {children}
            </main>
            <Footer />
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
