import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { TrpcProvider } from "../components/providers/TrpcProvider";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

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
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable)}>
      <body suppressHydrationWarning>
        <TrpcProvider>{children}</TrpcProvider>
      </body>
    </html>
  );
}
