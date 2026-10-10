import * as React from "react"

import { cn } from "~/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input placeholder:text-muted-foreground/80 focus-visible:border-primary focus-visible:ring-ring aria-invalid:ring-destructive/25 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-sm border bg-card px-3 py-2 font-mono text-[13px] transition-[color,box-shadow,border-color] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
