import './globals.css';

export const metadata = {
  title: 'Anqa',
  description: 'Webapp interface renderer',
  icons: [
    {
      rel: 'icon',
      type: 'image/png',
      url: '/q_no_background_dark.png',
      media: '(prefers-color-scheme: light)',
    },
    {
      rel: 'icon',
      type: 'image/png',
      url: '/q_no_background.png',
      media: '(prefers-color-scheme: dark)',
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}