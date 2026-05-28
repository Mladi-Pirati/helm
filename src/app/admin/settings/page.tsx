import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";

export default async function AdminSettingsPage() {
  const user = await requireUser();

  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-xs text-muted-foreground">
          Manage the account linked from Keycloak.
        </p>
      </div>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Account</CardTitle>
          <CardDescription>Signed in as @{user.username}.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-1">
            <p className="text-sm font-medium">{user.fullName}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>@{user.username}</span>
              <Badge variant={user.role === "admin" ? "default" : "outline"}>
                {user.role}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
