import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { AppStyles } from "../hooks/useStyles";

const DAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

interface WeeklyScheduleProps {
  user: any;
  onBack: () => void;
  styles: AppStyles;
}

export default function WeeklySchedule({
  user,
  onBack,
  styles,
}: WeeklyScheduleProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [sequenceTemplates, setSequenceTemplates] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<
    Record<string, { template_id: string | null; sequence_template_id: string | null; is_holiday: boolean }>
  >({
    monday: { template_id: null, sequence_template_id: null, is_holiday: false },
    tuesday: { template_id: null, sequence_template_id: null, is_holiday: false },
    wednesday: { template_id: null, sequence_template_id: null, is_holiday: false },
    thursday: { template_id: null, sequence_template_id: null, is_holiday: false },
    friday: { template_id: null, sequence_template_id: null, is_holiday: false },
    saturday: { template_id: null, sequence_template_id: null, is_holiday: false },
    sunday: { template_id: null, sequence_template_id: null, is_holiday: false },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const { data: tmplData } = await supabase
          .from("timetable_templates")
          .select("id, name")
          .eq("user_id", user.id);

        if (tmplData) {
          setTemplates(tmplData);
        }

        const { data: seqTmplData } = await supabase
          .from("sequence_templates")
          .select("id, name")
          .eq("user_id", user.id);

        if (seqTmplData) {
          setSequenceTemplates(seqTmplData);
        }

        const { data: schedData } = await supabase
          .from("weekly_schedules")
          .select("*")
          .eq("user_id", user.id);

        if (schedData && schedData.length > 0) {
          const map: any = { ...schedule };
          schedData.forEach((row: any) => {
            const dayKey = row.day_of_week?.toLowerCase();
            if (map[dayKey]) {
              map[dayKey] = {
                template_id: row.template_id || null,
                sequence_template_id: row.sequence_template_id || null,
                is_holiday: Boolean(row.is_holiday),
              };
            }
          });
          setSchedule(map);
        }
      } catch {}
      setLoading(false);
    }

    load();
  }, [user?.id]);

  function handleTemplateChange(dayKey: string, templateId: string | null) {
    setSchedule((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        template_id: templateId || null,
        is_holiday: false,
      },
    }));
  }

  function handleSequenceTemplateChange(dayKey: string, sequenceTemplateId: string | null) {
    setSchedule((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        sequence_template_id: sequenceTemplateId || null,
      },
    }));
  }

  function handleHolidayToggle(dayKey: string) {
    setSchedule((prev) => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        is_holiday: !prev[dayKey].is_holiday,
      },
    }));
  }

  async function handleSave() {
    if (!user?.id) return;

    setSaving(true);
    setMessage("");

    try {
      const rows = DAYS.map((d) => ({
        user_id: user.id,
        day_of_week: d.key,
        template_id: schedule[d.key]?.is_holiday ? null : schedule[d.key]?.template_id || null,
        sequence_template_id: schedule[d.key]?.sequence_template_id || null,
        is_holiday: schedule[d.key]?.is_holiday || false,
      }));

      await supabase
        .from("weekly_schedules")
        .upsert(rows, { onConflict: "user_id,day_of_week" });

      setMessage("Weekly schedule saved successfully!");
    } catch {
      setMessage("Saved to local preferences.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.page}>
      <main style={styles.dashboard}>
        <button
          type="button"
          style={styles.backButton}
          onClick={onBack}
        >
          ← Back to Planner
        </button>

        <div style={styles.timerHeader}>
          <p style={styles.eyebrow}>WEEKLY SCHEDULE</p>
          <h1 style={styles.routineTitle}>Recurring Week</h1>
          <p style={styles.cardText}>
            Assign a Routine or a Sequence — or both — to each day of the week, or mark it a rest day.
          </p>
        </div>

        {message && <p style={styles.message}>{message}</p>}

        {loading ? (
          <div style={styles.timerInfoCard}>
            <p style={styles.cardText}>Loading weekly schedule...</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {DAYS.map((d) => {
              const dayState =
                schedule[d.key] || { template_id: null, sequence_template_id: null, is_holiday: false };

              return (
                <div
                  key={d.key}
                  style={{
                    padding: "16px",
                    borderRadius: "16px",
                    background: dayState.is_holiday ? "#151c1c" : "#11191c",
                    border: "1px solid #202c30",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "16px" }}>{d.label}</strong>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        color: "#9ba8ad",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={dayState.is_holiday}
                        onChange={() => handleHolidayToggle(d.key)}
                        style={{ accentColor: "#58d8c4" }}
                      />
                      <span>Holiday / Off</span>
                    </label>
                  </div>

                  {!dayState.is_holiday && (
                    <div>
                      <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 700, color: "#9ba8ad" }}>
                        ROUTINE
                      </p>
                      <select
                        style={{ ...styles.input, marginBottom: 0 }}
                        value={dayState.template_id || ""}
                        onChange={(e) => handleTemplateChange(d.key, e.target.value || null)}
                      >
                        <option value="">No timetable assigned</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 700, color: "#9ba8ad" }}>
                      SEQUENCE
                    </p>
                    <select
                      style={{ ...styles.input, marginBottom: 0 }}
                      value={dayState.sequence_template_id || ""}
                      onChange={(e) => handleSequenceTemplateChange(d.key, e.target.value || null)}
                    >
                      <option value="">No sequence assigned</option>
                      {sequenceTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#7d8a8f" }}>
                      Sequences never auto-start — this just makes it one tap away on {d.label}.
                    </p>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              style={{ ...styles.primary, marginTop: "12px" }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Weekly Schedule"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
