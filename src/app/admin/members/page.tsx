import { Button } from "@/components/ui/button";

export default async function MembersPage() {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold">Members</h1>
          <p className="text-xs text-muted-foreground">
            Review applications from a stable server-filtered queue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href="/admin/members/applications">Applications</a>
          </Button>
        </div>
      </div>
    </div>
  )
}