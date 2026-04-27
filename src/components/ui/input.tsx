import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm text-navy placeholder:text-navy/40",
        "focus:outline-none focus:ring-2 focus:ring-orange/50 focus:border-orange",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
