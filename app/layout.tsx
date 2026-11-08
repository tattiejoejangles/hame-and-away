/** The app is route handlers rather than pages, but Next wants a root layout
 *  to exist. Nothing renders through it. */
export const metadata = { title: 'Hame & Away' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
