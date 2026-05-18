import { renderToBuffer } from "@react-pdf/renderer";
import { format } from "date-fns";
import { desc } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import JSZip from "jszip";

import {
  MembershipApplicationPdfDocument,
  type MembershipApplicationPdfRow,
} from "@/components/admin/membership-applications/application-pdf";
import { db } from "@/db";
import { mladiPiratiMembershipApplications } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import {
  parseMembershipApplicationsFilters,
  type MembershipApplicationStatus,
  type ParticipationMode,
  type ResidenceRegion,
} from "@/lib/membership-applications";
import { buildMembershipApplicationsWhere } from "@/lib/membership-applications-query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cachedLogo: Buffer | null = null;

async function getLogo(): Promise<Buffer> {
  if (!cachedLogo) {
    cachedLogo = await readFile(
      path.join(process.cwd(), "public", "logo.png"),
    );
  }

  return cachedLogo;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function GET(request: NextRequest) {
  await requireAdmin();

  const rawSearchParams = Object.fromEntries(
    request.nextUrl.searchParams.entries(),
  );
  const filters = parseMembershipApplicationsFilters(rawSearchParams);
  const whereClause = buildMembershipApplicationsWhere(filters);

  const baseQuery = db
    .select({
      id: mladiPiratiMembershipApplications.id,
      fullName: mladiPiratiMembershipApplications.fullName,
      dateOfBirth: mladiPiratiMembershipApplications.dateOfBirth,
      placeOfBirth: mladiPiratiMembershipApplications.placeOfBirth,
      streetAddress: mladiPiratiMembershipApplications.streetAddress,
      cityAndPostalCode: mladiPiratiMembershipApplications.cityAndPostalCode,
      residenceRegion: mladiPiratiMembershipApplications.residenceRegion,
      email: mladiPiratiMembershipApplications.email,
      phone: mladiPiratiMembershipApplications.phone,
      participationMode: mladiPiratiMembershipApplications.participationMode,
      discordUsername: mladiPiratiMembershipApplications.discordUsername,
      motivation: mladiPiratiMembershipApplications.motivation,
      consentsToDataProcessing:
        mladiPiratiMembershipApplications.consentsToDataProcessing,
      acceptsStatuteAndProgram:
        mladiPiratiMembershipApplications.acceptsStatuteAndProgram,
      status: mladiPiratiMembershipApplications.status,
      rejectionReason: mladiPiratiMembershipApplications.rejectionReason,
      createdAt: mladiPiratiMembershipApplications.createdAt,
      updatedAt: mladiPiratiMembershipApplications.updatedAt,
    })
    .from(mladiPiratiMembershipApplications);

  const rows = await (whereClause
    ? baseQuery.where(whereClause)
    : baseQuery
  ).orderBy(desc(mladiPiratiMembershipApplications.createdAt));

  if (rows.length === 0) {
    return new Response("No applications match the current filters.", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const logo = await getLogo();
  const generatedAt = new Date();
  const zip = new JSZip();
  const usedFilenames = new Set<string>();

  for (const row of rows) {
    const pdfRow: MembershipApplicationPdfRow = {
      ...row,
      participationMode: row.participationMode as ParticipationMode,
      residenceRegion: row.residenceRegion as ResidenceRegion,
      status: row.status as MembershipApplicationStatus,
    };

    const buffer = await renderToBuffer(
      <MembershipApplicationPdfDocument
        row={pdfRow}
        logo={logo}
        generatedAt={generatedAt}
      />,
    );

    const baseName = `${slugify(row.fullName) || "application"}-${row.id.slice(0, 8)}`;
    let filename = `${baseName}.pdf`;
    let counter = 2;
    while (usedFilenames.has(filename)) {
      filename = `${baseName}-${counter}.pdf`;
      counter += 1;
    }
    usedFilenames.add(filename);

    zip.file(filename, buffer);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const downloadName = `membership-applications-${format(generatedAt, "yyyy-MM-dd")}.zip`;

  return new Response(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${downloadName}"`,
      "Cache-Control": "no-store",
    },
  });
}
