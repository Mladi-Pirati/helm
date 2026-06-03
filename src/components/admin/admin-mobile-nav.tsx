"use client";

import { useState } from "react";

import { logoutAction } from "@/actions/auth";
import { AdminNavLinks } from "@/components/admin/admin-nav-links";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ListIcon, LogOutIcon, SettingsIcon } from "lucide-react";
import Link from "next/link";

type AdminMobileNavProps = {
  fullName: string;
  username: string;
  permissions: Array<string>;
};

export function AdminMobileNav({
  fullName,
  username,
  permissions,
}: AdminMobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger asChild>
        <Button size="icon-sm" variant="outline">
          <ListIcon className="size-4" />
          <span className="sr-only">Open navigation</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full max-w-xs" side="left">
        <SheetHeader className="border-b">
          <SheetTitle></SheetTitle>
          <div className="grid gap-1 text-left">
            <p className="text-sm font-medium">{fullName}</p>
            <p className="text-xs text-muted-foreground">@{username}</p>
          </div>
        </SheetHeader>
        <div className="grid gap-4 p-4">
          <AdminNavLinks
            permissions={permissions}
            onNavigate={() => setOpen(false)}
          />
          <Separator />
          <Link
            href="/admin/settings"
            className={buttonVariants({ variant: "outline" })}
          >
            <SettingsIcon />
            Settings
          </Link>
          <form
            action={logoutAction}
            onSubmit={() => {
              setOpen(false);
            }}
          >
            <Button className="w-full" type="submit" variant="destructive">
              <LogOutIcon />
              Log out
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
