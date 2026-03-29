import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TrpcProvider } from "../components/providers/TrpcProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Carelog",
  description: "Care coordination for families",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <TrpcProvider>{children}</TrpcProvider>
      </body>
    </html>
  );
}
