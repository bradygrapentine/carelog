import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { EventType } from '@carelog/types'

const s = StyleSheet.create({
  page:        { padding: 48, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
  title:       { fontSize: 18, fontWeight: 'bold', marginBottom: 4 },
  subtitle:    { fontSize: 11, color: '#6b7280', marginBottom: 24 },
  section:     { marginBottom: 16 },
  sectionHead: { fontSize: 11, fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 4, marginBottom: 8 },
  row:         { flexDirection: 'row', marginBottom: 4 },
  label:       { width: 100, color: '#6b7280' },
  value:       { flex: 1 },
  item:        { marginBottom: 6, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  footer:      { position: 'absolute', bottom: 24, left: 48, right: 48, textAlign: 'center', color: '#9ca3af', fontSize: 8 },
})

type CareEventRow = {
  id:           string
  event_type:   EventType
  entry_kind:   'human' | 'system'
  occurred_at:  string
  flagged:      boolean
  payload:      Record<string, unknown>
}

type SymptomReadingRow = {
  id:          string
  pain_level:  number | null
  mood:        string | null
  appetite:    string | null
  mobility:    string | null
  notes:       string | null
  recorded_at: string
}

type MedicationRow = {
  id:           string
  drug_name:    string
  dosage:       string | null
  form:         string | null
  instructions: string | null
  prescriber:   string | null
  active:       boolean
  created_at:   string
}

type ShiftRow = {
  id:               string
  assignee_user_id: string | null
  start_at:         string
  end_at:           string | null
  notes:            string | null
  status:           string
}

type ExportData = {
  recipient_name:   string
  dob:              string | null
  exported_at:      string
  since:            string | null
  care_events:      CareEventRow[]
  symptom_readings: SymptomReadingRow[]
  medications:      MedicationRow[]
  shifts:           ShiftRow[]
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ExportDocument({ data }: { data: ExportData }) {
  return (
    <Document>
      <Page size="LETTER" style={s.page}>

        {/* Header */}
        <Text style={s.title}>{'Care History — ' + data.recipient_name}</Text>
        <Text style={s.subtitle}>
          {'Exported ' + formatDate(data.exported_at) +
            (data.dob ? ' · DOB: ' + data.dob : '') +
            (data.since ? ' · Since: ' + formatDate(data.since) : '')}
        </Text>

        {/* Medications */}
        <View style={s.section}>
          <Text style={s.sectionHead}>{'Medications (' + data.medications.length + ')'}</Text>
          {data.medications.length === 0 && <Text style={s.value}>No medications on record.</Text>}
          {data.medications.map((m, i) => (
            <View key={i} style={s.item}>
              <View style={s.row}>
                <Text style={s.label}>Drug</Text>
                <Text style={s.value}>{m.drug_name + (m.active ? '' : ' (inactive)')}</Text>
              </View>
              {m.dosage       && <View style={s.row}><Text style={s.label}>Dosage</Text><Text style={s.value}>{m.dosage}</Text></View>}
              {m.instructions && <View style={s.row}><Text style={s.label}>Instructions</Text><Text style={s.value}>{m.instructions}</Text></View>}
              {m.prescriber   && <View style={s.row}><Text style={s.label}>Prescriber</Text><Text style={s.value}>{m.prescriber}</Text></View>}
            </View>
          ))}
        </View>

        {/* Symptom readings */}
        <View style={s.section}>
          <Text style={s.sectionHead}>{'Symptom Readings (' + data.symptom_readings.length + ')'}</Text>
          {data.symptom_readings.length === 0 && <Text style={s.value}>No symptom readings on record.</Text>}
          {data.symptom_readings.map((r, i) => (
            <View key={i} style={s.item}>
              <View style={s.row}>
                <Text style={s.label}>Date</Text>
                <Text style={s.value}>{formatDate(r.recorded_at)}</Text>
              </View>
              {r.pain_level !== null && <View style={s.row}><Text style={s.label}>Pain</Text><Text style={s.value}>{r.pain_level + '/10'}</Text></View>}
              {r.mood     && <View style={s.row}><Text style={s.label}>Mood</Text><Text style={s.value}>{r.mood}</Text></View>}
              {r.appetite && <View style={s.row}><Text style={s.label}>Appetite</Text><Text style={s.value}>{r.appetite}</Text></View>}
              {r.mobility && <View style={s.row}><Text style={s.label}>Mobility</Text><Text style={s.value}>{r.mobility}</Text></View>}
              {r.notes    && <View style={s.row}><Text style={s.label}>Notes</Text><Text style={s.value}>{r.notes}</Text></View>}
            </View>
          ))}
        </View>

        {/* Shifts */}
        <View style={s.section}>
          <Text style={s.sectionHead}>{'Shifts (' + data.shifts.length + ')'}</Text>
          {data.shifts.length === 0 && <Text style={s.value}>No shifts on record.</Text>}
          {data.shifts.map((sh, i) => (
            <View key={i} style={s.item}>
              <View style={s.row}>
                <Text style={s.label}>Start</Text>
                <Text style={s.value}>{formatDate(sh.start_at)}</Text>
              </View>
              {sh.end_at && <View style={s.row}><Text style={s.label}>End</Text><Text style={s.value}>{formatDate(sh.end_at)}</Text></View>}
              <View style={s.row}><Text style={s.label}>Status</Text><Text style={s.value}>{sh.status}</Text></View>
              {sh.notes && <View style={s.row}><Text style={s.label}>Notes</Text><Text style={s.value}>{sh.notes}</Text></View>}
            </View>
          ))}
        </View>

        {/* Journal entries */}
        <View style={s.section}>
          <Text style={s.sectionHead}>{'Journal Entries (' + data.care_events.filter((e) => e.entry_kind === 'human').length + ')'}</Text>
          {data.care_events.filter((e) => e.entry_kind === 'human').length === 0 && (
            <Text style={s.value}>No journal entries on record.</Text>
          )}
          {data.care_events.filter((e) => e.entry_kind === 'human').map((e, i) => (
            <View key={i} style={s.item}>
              <View style={s.row}>
                <Text style={s.label}>{formatDate(e.occurred_at)}</Text>
                <Text style={s.value}>{e.payload?.text ?? ''}</Text>
              </View>
              {e.payload?.mood && <View style={s.row}><Text style={s.label}>Mood</Text><Text style={s.value}>{e.payload.mood}</Text></View>}
              {e.flagged && <Text style={{ color: '#dc2626', fontSize: 9 }}>Flagged for follow-up</Text>}
            </View>
          ))}
        </View>

        <Text style={s.footer}>{'Generated by Carelog · ' + data.exported_at}</Text>
      </Page>
    </Document>
  )
}
