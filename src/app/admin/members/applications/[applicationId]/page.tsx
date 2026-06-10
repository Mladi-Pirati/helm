import { differenceInYears } from "date-fns";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { MembershipApplicationStatusForm } from "@/components/admin/membership-applications/membership-application-status-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import { mladiPiratiMembershipApplications } from "@/db/schema";
import { requirePermission } from "@/lib/auth/permissions";
import {
  formatSlovenianDate,
  formatSlovenianDateTime,
  parseDateOnly,
} from "@/lib/date-format";
import {
  buildMembershipApplicationsListHref,
  getMembershipApplicationStatusVariant,
  membershipApplicationStatusLabels,
  parseMembershipApplicationsFilters,
  type MembershipApplicationsSearchParams,
  type ResidenceRegion,
} from "@/lib/membership-applications";

function formatDateTime(value: Date) {
  return formatSlovenianDateTime(value);
}

function formatDateOnly(value: string) {
  return formatSlovenianDate(parseDateOnly(value));
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid gap-1">
      <dt className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-xs/relaxed text-foreground">{value}</dd>
    </div>
  );
}

export default async function AdminMembershipApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<MembershipApplicationsSearchParams>;
}) {
  await requirePermission("members.read");
  const { applicationId } = await params;
  const filters = parseMembershipApplicationsFilters(await searchParams);
  const backHref = buildMembershipApplicationsListHref(filters);

  const [application] = await db
    .select({
      id: mladiPiratiMembershipApplications.id,
      firstName: mladiPiratiMembershipApplications.firstName,
      fullLegalName: mladiPiratiMembershipApplications.fullLegalName,
      lastName: mladiPiratiMembershipApplications.lastName,
      dateOfBirth: mladiPiratiMembershipApplications.dateOfBirth,
      placeOfBirth: mladiPiratiMembershipApplications.placeOfBirth,
      streetAddress: mladiPiratiMembershipApplications.streetAddress,
      cityAndPostalCode:
        mladiPiratiMembershipApplications.cityAndPostalCode,
      residenceRegion: mladiPiratiMembershipApplications.residenceRegion,
      email: mladiPiratiMembershipApplications.email,
      phone: mladiPiratiMembershipApplications.phone,
      discordUsername: mladiPiratiMembershipApplications.discordUsername,
      motivation: mladiPiratiMembershipApplications.motivation,
      consentsToDataProcessing:
        mladiPiratiMembershipApplications.consentsToDataProcessing,
      acceptsStatuteAndProgram:
        mladiPiratiMembershipApplications.acceptsStatuteAndProgram,
      status: mladiPiratiMembershipApplications.status,
      rejectionReason: mladiPiratiMembershipApplications.rejectionReason,
      memberCreationStatus:
        mladiPiratiMembershipApplications.memberCreationStatus,
      createdAt: mladiPiratiMembershipApplications.createdAt,
      updatedAt: mladiPiratiMembershipApplications.updatedAt,
    })
    .from(mladiPiratiMembershipApplications)
    .where(eq(mladiPiratiMembershipApplications.id, applicationId));

  if (!application) {
    notFound();
  }

  const residenceRegion = application.residenceRegion as ResidenceRegion;
  const displayName =
    `${application.firstName} ${application.lastName}`.trim();

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={backHref}>Back to applications</Link>
          </Button>
          <div className="grid gap-1">
            <h1 className="text-xl font-semibold">{displayName}</h1>
            <p className="text-xs text-muted-foreground">
              Submitted on {formatDateTime(application.createdAt)}
            </p>
          </div>
        </div>
        <Badge variant={getMembershipApplicationStatusVariant(application.status)}>
          {membershipApplicationStatusLabels[application.status]}
        </Badge>
      </div>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Review</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <MembershipApplicationStatusForm
            applicationId={application.id}
            key={[
              application.id,
              application.status,
              application.rejectionReason ?? "",
              application.memberCreationStatus ?? "",
            ].join(":")}
            currentMemberCreationStatus={application.memberCreationStatus}
            currentRejectionReason={application.rejectionReason}
            currentStatus={application.status}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Identity and contact</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailItem label="First name (preferred name)" value={application.firstName} />
              <DetailItem label="Last name" value={application.lastName} />
              <DetailItem label="Full legal name" value={application.fullLegalName} />
              <DetailItem label="Email" value={application.email} />
              <DetailItem
                label="Phone"
                value={
                  application.phone ?? (
                    <span className="text-muted-foreground">Not provided</span>
                  )
                }
              />
              <DetailItem
                label="Discord username"
                value={
                  application.discordUsername ?? (
                    <span className="text-muted-foreground">Not provided</span>
                  )
                }
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Address and birth</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailItem
                label="Date of birth"
                value={`${formatDateOnly(application.dateOfBirth)} (${differenceInYears(new Date(), parseDateOnly(application.dateOfBirth))})`}
              />
              <DetailItem
                label="Place of birth"
                value={application.placeOfBirth}
              />
              <DetailItem
                label="Street address"
                value={application.streetAddress}
              />
              <DetailItem
                label="City and postal code"
                value={application.cityAndPostalCode}
              />
              <DetailItem label="Residence region" value={residenceRegion} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Motivation</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4">
              <DetailItem
                label="Motivation"
                value={
                  application.motivation ? (
                    <p className="whitespace-pre-wrap">{application.motivation}</p>
                  ) : (
                    <span className="text-muted-foreground">Not provided</span>
                  )
                }
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Consents and metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailItem
                label="Data processing"
                value={
                  <Badge
                    variant={
                      application.consentsToDataProcessing ? "default" : "outline"
                    }
                  >
                    {application.consentsToDataProcessing
                      ? "Granted"
                      : "Missing"}
                  </Badge>
                }
              />
              <DetailItem
                label="Statute and program"
                value={
                  <Badge
                    variant={
                      application.acceptsStatuteAndProgram
                        ? "default"
                        : "outline"
                    }
                  >
                    {application.acceptsStatuteAndProgram
                      ? "Accepted"
                      : "Missing"}
                  </Badge>
                }
              />
              <DetailItem label="Application ID" value={application.id} />
              <DetailItem
                label="Last updated"
                value={formatDateTime(application.updatedAt)}
              />
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
