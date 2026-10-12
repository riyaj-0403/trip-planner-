import type { ReactNode } from "react"
import { Toaster } from "@/components/ui/sonner"
import { Navbar } from "./Navbar"
import { Footer } from "./Footer"

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {children}
      </main>
      <Footer />
      <Toaster />
    </div>
  )
}