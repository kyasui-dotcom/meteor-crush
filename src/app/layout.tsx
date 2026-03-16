import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meteor Crush",
  description: "Space-themed falling block puzzle with bomb chain mechanics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, overflow: 'hidden', background: '#0a0a1a' }}>
        {children}
      </body>
    </html>
  );
}
