import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "BudgetApp — Personal Budget Tracker",
  description: "Track your daily spending, monitor budget performance, and manage debts. A personal budgeting app for university students.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <div className="app-layout">
            <Navbar />
            <main className="main-content">
              {children}
            </main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
