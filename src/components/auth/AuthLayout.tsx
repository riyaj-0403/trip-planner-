import type { ReactNode } from "react"
import { Plane } from "lucide-react"
import TripImage from "../TripImage"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Picture panel: desktop only, so phones get the form straight away */}
      <div className="relative hidden lg:block">
        <TripImage
          src="/images/auth/hero.webp"
          alt=""
          priority
          className="absolute inset-0 h-full w-full"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-10 bottom-10 text-white">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Plane className="size-5" /> Trip Planner
          </div>
          <p className="mt-2 max-w-sm text-sm text-white/85">
            Plan every stop, day and budget in one place.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-10">{children}</div>
    </div>
  )
}