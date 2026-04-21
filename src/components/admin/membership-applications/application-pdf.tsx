import {
  Document,
  Font,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { format } from "date-fns";
import path from "node:path";

import {
  membershipApplicationStatusLabels,
  participationModeLabels,
  type MembershipApplicationStatus,
  type ParticipationMode,
  type ResidenceRegion,
} from "@/lib/membership-applications";

const geistFontPath = path.join(
  process.cwd(),
  "public",
  "fonts",
  "Geist-Regular.ttf",
);

Font.register({
  family: "Geist",
  fonts: [
    { src: geistFontPath, fontWeight: 400, fontStyle: "normal" },
    { src: geistFontPath, fontWeight: 700, fontStyle: "normal" },
    { src: geistFontPath, fontWeight: 400, fontStyle: "italic" },
    { src: geistFontPath, fontWeight: 700, fontStyle: "italic" },
  ],
});

export type MembershipApplicationPdfRow = {
  id: string;
  fullName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  streetAddress: string;
  cityAndPostalCode: string;
  residenceRegion: ResidenceRegion;
  email: string;
  phone: string | null;
  participationMode: ParticipationMode;
  discordUsername: string | null;
  motivation: string | null;
  consentsToDataProcessing: boolean;
  acceptsStatuteAndProgram: boolean;
  status: MembershipApplicationStatus;
  createdAt: Date;
  updatedAt: Date;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: "Geist",
    color: "#111",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
  },
  logo: {
    width: 44,
    height: 44,
    marginRight: 14,
  },
  headerTextBlock: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: "#555",
  },
  statusPill: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#111",
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cellHalf: {
    width: "50%",
    paddingRight: 10,
    marginBottom: 10,
  },
  cellFull: {
    width: "100%",
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 8,
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 10,
    color: "#111",
  },
  fieldValueMuted: {
    fontSize: 10,
    color: "#999",
    fontStyle: "italic",
  },
  motivation: {
    fontSize: 10,
    color: "#111",
    lineHeight: 1.4,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  consentMark: {
    width: 14,
    textAlign: "center",
    fontWeight: 700,
    marginRight: 6,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#888",
  },
});

function Field({
  label,
  value,
  full = false,
}: {
  label: string;
  value: string | null;
  full?: boolean;
}) {
  return (
    <View style={full ? styles.cellFull : styles.cellHalf}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {value ? (
        <Text style={styles.fieldValue}>{value}</Text>
      ) : (
        <Text style={styles.fieldValueMuted}>Not provided</Text>
      )}
    </View>
  );
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

export function MembershipApplicationPdfDocument({
  row,
  logo,
  generatedAt,
}: {
  row: MembershipApplicationPdfRow;
  logo: Buffer;
  generatedAt: Date;
}) {
  const submittedAt = format(row.createdAt, "PPP p");
  const updatedAt = format(row.updatedAt, "PPP p");
  const birthDate = format(parseDateOnly(row.dateOfBirth), "PPP");
  const generatedAtLabel = format(generatedAt, "PPP p");

  return (
    <Document
      title={`Membership application — ${row.fullName}`}
      author="Mladi Pirati"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <PdfImage style={styles.logo} src={logo} />
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>
              Mladi Pirati — vloga za članstvo
            </Text>
            <Text style={styles.subtitle}>Submitted {submittedAt}</Text>
          </View>
          <Text style={styles.statusPill}>
            {membershipApplicationStatusLabels[row.status]}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identity and contact</Text>
          <View style={styles.grid}>
            <Field label="Full name" value={row.fullName} />
            <Field label="Email" value={row.email} />
            <Field label="Phone" value={row.phone} />
            <Field label="Discord username" value={row.discordUsername} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Address and birth</Text>
          <View style={styles.grid}>
            <Field label="Date of birth" value={birthDate} />
            <Field label="Place of birth" value={row.placeOfBirth} />
            <Field label="Street address" value={row.streetAddress} />
            <Field label="City and postal code" value={row.cityAndPostalCode} />
            <Field label="Residence region" value={row.residenceRegion} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Participation and motivation</Text>
          <View style={styles.grid}>
            <Field
              label="Participation mode"
              value={participationModeLabels[row.participationMode]}
              full
            />
            <View style={styles.cellFull}>
              <Text style={styles.fieldLabel}>Motivation</Text>
              {row.motivation ? (
                <Text style={styles.motivation}>{row.motivation}</Text>
              ) : (
                <Text style={styles.fieldValueMuted}>Not provided</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Consents and metadata</Text>
          <View style={styles.consentRow}>
            <Text style={styles.consentMark}>
              {row.consentsToDataProcessing ? "\u2713" : "\u2717"}
            </Text>
            <Text style={styles.fieldValue}>
              Data processing —{" "}
              {row.consentsToDataProcessing ? "Granted" : "Missing"}
            </Text>
          </View>
          <View style={styles.consentRow}>
            <Text style={styles.consentMark}>
              {row.acceptsStatuteAndProgram ? "\u2713" : "\u2717"}
            </Text>
            <Text style={styles.fieldValue}>
              Statute and program —{" "}
              {row.acceptsStatuteAndProgram ? "Accepted" : "Missing"}
            </Text>
          </View>
          <View style={[styles.grid, { marginTop: 8 }]}>
            <Field label="Application ID" value={row.id} />
            <Field label="Last updated" value={updatedAt} />
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>Generated {generatedAtLabel}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
