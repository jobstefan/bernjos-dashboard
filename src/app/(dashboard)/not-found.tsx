import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FileQuestion className="size-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Not found</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        The record you&apos;re looking for doesn&apos;t exist or may have been
        removed.
      </p>
      <Button className="mt-6" render={<Link href="/" />}>
        Back to dashboard
      </Button>
    </div>
  );
}
