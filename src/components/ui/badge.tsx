import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors",
  {
    variants: {
      variant: {
        default: "bg-brand text-white",
        secondary: "bg-slate-100 text-slate-700",
        destructive: "bg-red-100 text-red-800",
        outline: "border border-slate-300 bg-white text-slate-700",
        success: "bg-emerald-100 text-emerald-800",
        warning: "bg-amber-100 text-amber-800",
        info: "bg-sky-100 text-sky-800",
        brand: "bg-brand/10 text-brand",
      },
    },
    defaultVariants: { variant: "secondary" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
