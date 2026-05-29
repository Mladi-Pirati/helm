import {
  Document,
  Font,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import path from "node:path";

import {
  formatSlovenianDate,
  formatSlovenianDateTime,
  parseDateOnly,
} from "@/lib/date-format";
import {
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
  firstName: string;
  lastName: string;
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
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const pdfStatusLabels: Record<MembershipApplicationStatus, string> = {
  pending: "V obravnavi",
  approved: "Odobrena",
  rejected: "Zavrnjena",
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
        <Text style={styles.fieldValueMuted}>Ni navedeno</Text>
      )}
    </View>
  );
}

function getApplicationDisplayName(
  row: Pick<MembershipApplicationPdfRow, "firstName" | "lastName">,
) {
  return `${row.firstName} ${row.lastName}`.trim();
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
  const submittedAt = formatSlovenianDateTime(row.createdAt);
  const updatedAt = formatSlovenianDateTime(row.updatedAt);
  const birthDate = formatSlovenianDate(parseDateOnly(row.dateOfBirth));
  const generatedAtLabel = formatSlovenianDateTime(generatedAt);
  const displayName = getApplicationDisplayName(row);

  return (
    <Document
      title={`Vloga za članstvo - ${displayName}`}
      author="Mladi Pirati"
      language="sl-SI"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <PdfImage style={styles.logo} src={logo} />
          <View style={styles.headerTextBlock}>
            <Text style={styles.title}>
              Mladi Pirati - vloga za članstvo
            </Text>
            <Text style={styles.subtitle}>Oddano {submittedAt}</Text>
          </View>
          <Text style={styles.statusPill}>{pdfStatusLabels[row.status]}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identiteta in kontakt</Text>
          <View style={styles.grid}>
            <Field label="Ime" value={row.firstName} />
            <Field label="Priimek" value={row.lastName} />
            <Field label="E-pošta" value={row.email} />
            <Field label="Telefon" value={row.phone} />
            <Field label="Discord uporabniško ime" value={row.discordUsername} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Naslov in rojstvo</Text>
          <View style={styles.grid}>
            <Field label="Datum rojstva" value={birthDate} />
            <Field label="Kraj rojstva" value={row.placeOfBirth} />
            <Field label="Naslov" value={row.streetAddress} />
            <Field
              label="Kraj in poštna številka"
              value={row.cityAndPostalCode}
            />
            <Field label="Regija bivanja" value={row.residenceRegion} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sodelovanje in motivacija</Text>
          <View style={styles.grid}>
            <Field
              label="Način sodelovanja"
              value={participationModeLabels[row.participationMode]}
              full
            />
            <View style={styles.cellFull}>
              <Text style={styles.fieldLabel}>Motivacija</Text>
              {row.motivation ? (
                <Text style={styles.motivation}>{row.motivation}</Text>
              ) : (
                <Text style={styles.fieldValueMuted}>Ni navedeno</Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Soglasja in metapodatki</Text>
          <View style={styles.consentRow}>
            <Text style={styles.consentMark}>
              {row.consentsToDataProcessing ? "\u2713" : "\u2717"}
            </Text>
            <Text style={styles.fieldValue}>
              Obdelava osebnih podatkov -{" "}
              {row.consentsToDataProcessing ? "Podano" : "Manjka"}
            </Text>
          </View>
          <View style={styles.consentRow}>
            <Text style={styles.consentMark}>
              {row.acceptsStatuteAndProgram ? "\u2713" : "\u2717"}
            </Text>
            <Text style={styles.fieldValue}>
              Statut in program -{" "}
              {row.acceptsStatuteAndProgram ? "Sprejeto" : "Manjka"}
            </Text>
          </View>
          <View style={[styles.grid, { marginTop: 8 }]}>
            <Field label="ID vloge" value={row.id} />
            <Field label="Zadnja posodobitev" value={updatedAt} />
            <Field
              label="Razlog zavrnitve"
              value={row.rejectionReason}
              full
            />
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text>Ustvarjeno {generatedAtLabel}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Stran ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
