import '../styles/globals.scss';

export const metadata = {
  title: 'MIRAY Dashboard',
  description: 'Management dashboard for MIRAY in-memory key-value store',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
