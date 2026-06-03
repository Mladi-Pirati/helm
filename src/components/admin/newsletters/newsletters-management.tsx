"use client";

import Link from "next/link";

import { AddNewsletterSheet } from "@/components/admin/newsletters/add-newsletter-sheet";
import { ArchiveNewsletterDialog } from "@/components/admin/newsletters/archive-newsletter-dialog";
import { EditNewsletterSheet } from "@/components/admin/newsletters/edit-newsletter-sheet";
import { UnarchiveNewsletterDialog } from "@/components/admin/newsletters/unarchive-newsletter-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export type NewsletterListRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  subscriptionCount: number;
  archivedAt: string | null;
};

function NewsletterRows({
  canManage,
  rows,
}: {
  canManage: boolean;
  rows: Array<NewsletterListRow>;
}) {
  if (!rows.length) {
    return (
      <div className="flex h-32 items-center justify-center px-4 text-center text-xs text-muted-foreground">
        No newsletters found.
      </div>
    );
  }

  return (
    <div className="divide-y">
      {rows.map((row) => {
        const isArchived = row.archivedAt !== null;

        return (
          <div
            className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
            key={row.id}
          >
            <div className="grid min-w-0 gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  className="font-medium text-foreground hover:underline"
                  href={`/admin/newsletters/${row.slug}`}
                >
                  {row.name}
                </Link>
                {isArchived ? <Badge variant="outline">Archived</Badge> : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {row.description}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.subscriptionCount}{" "}
                {row.subscriptionCount === 1 ? "subscriber" : "subscribers"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Button asChild size="xs" variant="outline">
                <Link href={`/admin/newsletters/${row.slug}`}>Open</Link>
              </Button>
              {canManage ? (
                <>
                  <EditNewsletterSheet newsletter={row} />
                  {isArchived ? (
                    <UnarchiveNewsletterDialog newsletter={row} />
                  ) : (
                    <ArchiveNewsletterDialog newsletter={row} />
                  )}
                </>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function NewslettersManagement({
  activeRows,
  archivedRows,
  canManage,
  showArchived,
}: {
  activeRows: Array<NewsletterListRow>;
  archivedRows: Array<NewsletterListRow>;
  canManage: boolean;
  showArchived: boolean;
}) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold">Newsletters</h1>
          <p className="text-xs text-muted-foreground">
            Manage newsletter signup lists and collected email subscriptions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant={showArchived ? "outline" : "default"}>
            <Link href="/admin/newsletters">Active</Link>
          </Button>
          <Button asChild variant={showArchived ? "default" : "outline"}>
            <Link href="/admin/newsletters?archived=1">Archived</Link>
          </Button>
          {canManage ? <AddNewsletterSheet /> : null}
        </div>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>
            {showArchived ? "Archived newsletters" : "Active newsletters"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <NewsletterRows
            canManage={canManage}
            rows={showArchived ? archivedRows : activeRows}
          />
        </CardContent>
      </Card>
    </div>
  );
}
