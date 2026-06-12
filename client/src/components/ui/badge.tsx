import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { TaskPriorityEnum, TaskStatusEnum } from "@/constant";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold leading-5 transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        [TaskStatusEnum.BACKLOG]: "border-slate-200 bg-slate-100 text-slate-600",
        [TaskStatusEnum.TODO]: "border-blue-200 bg-blue-50 text-blue-700",
        [TaskStatusEnum.IN_PROGRESS]: "border-amber-200 bg-amber-50 text-amber-700",
        [TaskStatusEnum.IN_REVIEW]: "border-violet-200 bg-violet-50 text-violet-700",
        [TaskStatusEnum.DONE]: "border-emerald-200 bg-emerald-50 text-emerald-700",
        [TaskPriorityEnum.HIGH]: "border-orange-200 bg-orange-50 text-orange-700",
        [TaskPriorityEnum.MEDIUM]: "border-amber-200 bg-amber-50 text-amber-700",
        [TaskPriorityEnum.LOW]: "border-slate-200 bg-slate-50 text-slate-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge };
