import type { ReactNode } from "react"
import { useLocation } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { Navbar } from "./Navbar"
import { Footer } from "./Footer"

const AUTH_PATHS = ["/login", "/register"]

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const isAuthPage = AUTH_PATHS.includes(pathname)

  if (isAuthPage) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {children}
        <Toaster />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>
      <Footer />
      <Toaster />
    </div>
  )
}