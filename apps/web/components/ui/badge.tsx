import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "~/lib/utils"

// Stub tags: PUBLISHED (outline), DRAFT (ember), KEYPAD (ink).
const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-[2px] border px-1.5 py-[3px] font-mono text-[9px] leading-none font-medium tracking-[0.12em] uppercase w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-colors overflow-hidden",
  {
    variants: {
      variant: {
        default: "border-solid bg-solid text-solid-foreground",
        secondary: "border-foreground/55 bg-transparent text-foreground",
        ember: "border-primary bg-primary text-primary-foreground",
        destructive: "border-destructive bg-destructive text-white",
        outline: "border-border text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
