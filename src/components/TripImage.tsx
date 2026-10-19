import { useState } from "react"
import { Plane } from "lucide-react"
import { cn } from "@/lib/utils"

interface TripImageProps {
  src?: string | null
  /** Use "" when the title is shown right next to the picture (decorative). */
  alt: string
  /** Give the box a size here, e.g. "aspect-[16/9] w-full" */
  className?: string
  /** true for the big image at the top of a page, so it loads first */
  priority?: boolean
}

export default function TripImage({ src, alt, className, priority = false }: TripImageProps) {
  // Remember which URL failed, so a later, different URL still gets a chance.
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = Boolean(src) && src !== failedSrc

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {showImage ? (
        <img
          src={src!}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailedSrc(src!)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className="flex h-full w-full items-center justify-center bg-linear-to-br from-primary/20 to-primary/5"
        >
          <Plane className="size-8 text-primary/50" />
        </div>
      )}
    </div>
  )
}