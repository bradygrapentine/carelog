import * as React from "react";
import { CardHeader } from "./card";
import { cn } from "@/lib/utils";

type Props = React.ComponentProps<"div">;

export function CardHeaderTinted({ className, ...props }: Props) {
  return (
    <CardHeader className={cn("card-header-tinted", className)} {...props} />
  );
}

export function CardHeaderOutline({ className, ...props }: Props) {
  return (
    <CardHeader className={cn("card-header-outline", className)} {...props} />
  );
}

export function CardHeaderAccent({ className, ...props }: Props) {
  return (
    <CardHeader className={cn("card-header-accent", className)} {...props} />
  );
}

export function CardHeaderSerif({ className, ...props }: Props) {
  return (
    <CardHeader
      className={cn("card-header-serif headline-display", className)}
      {...props}
    />
  );
}
