import * as React from "react";
import { PageHeader as SabPageHeader } from "@/components/sab";

// Thin shim — forwards to the SAB PageHeader so every page that already imports
// `@/components/ui/page-header` inherits the warm-paper editorial look.
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <SabPageHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={actions}
    />
  );
}
