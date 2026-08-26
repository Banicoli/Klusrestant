import './globals.css';

export const metadata = {
  title: 'Klusrestant',
  description: 'Restmaterialen opnieuw gebruikt in plaats van weggegooid.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="nl"><body>{children}</body></html>;
}