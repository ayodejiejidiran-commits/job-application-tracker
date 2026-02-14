import React from "react";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ResumeJSON } from "@/lib/resumeMatch";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, lineHeight: 1.25 },
  name: { fontSize: 16, marginBottom: 4 },
  headline: { marginBottom: 8 },
  sectionTitle: { fontSize: 11, marginTop: 10, marginBottom: 4 },
  bullet: { marginLeft: 10, marginBottom: 2 }
});

function trimToOnePage(resume: ResumeJSON) {
  const copy: ResumeJSON = structuredClone(resume);

  copy.experiences = (copy.experiences ?? []).slice(0, 3).map((e) => ({
    ...e,
    bullets: (e.bullets ?? []).slice(0, 3).map((b) =>
      b.length > 120 ? `${b.slice(0, 117)}...` : b
    )
  }));

  copy.skills = (copy.skills ?? []).slice(0, 12);

  if (copy.summary && copy.summary.length > 260) {
    copy.summary = `${copy.summary.slice(0, 257)}...`;
  }

  return copy;
}

export function ResumeOnePagePDF({ resume }: { resume: ResumeJSON }) {
  const r = trimToOnePage(resume);

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {r.name ? <Text style={styles.name}>{r.name}</Text> : null}
        {r.summary ? (
          <>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text>{r.summary}</Text>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Experience</Text>
        {(r.experiences ?? []).map((e, idx) => (
          <View key={idx}>
            <Text>{`${e.title ?? ""}${e.company ? ` - ${e.company}` : ""}`}</Text>
            {(e.bullets ?? []).map((b, i) => (
              <Text key={i} style={styles.bullet}>{`- ${b}`}</Text>
            ))}
          </View>
        ))}

        {(r.skills ?? []).length ? (
          <>
            <Text style={styles.sectionTitle}>Skills</Text>
            <Text>{(r.skills ?? []).join(" | ")}</Text>
          </>
        ) : null}
      </Page>
    </Document>
  );
}
