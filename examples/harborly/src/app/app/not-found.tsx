import { SearchX } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "./_components/empty-state";

export default function AppNotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="We couldn’t find that page"
      description="The project may have been removed, or the link is mistyped."
      className="mx-auto mt-10 max-w-lg py-16"
      action={
        <Link href="/app/projects" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Back to projects
        </Link>
      }
    />
  );
}
