import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { AppStyles } from "../hooks/useStyles";
import useAlarms from "../hooks/useAlarms";
import AlarmSelector from "../components/AlarmSelector";
import ColorSelector from "../components/ColorSelector";
import { ClockIcon, CoffeeIcon, PlusIcon, TrashIcon } from "../components/Icons";

function formatTime(time: string) {
  if (!time) return "";
  const [hours, minutes] = time.slice(0, 5).split(":");
  const hour = Number(hours);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${suffix}`;
}

// No hardcoded clock default (e.g. a fixed "09:00") — a brand-new period
// should default to the actual current time, rounded up to the next 5
// minutes, so the time picker opens near "now" instead of always jumping
// to 9 AM regardless of when it actually is. Editing an existing period
// is untouched — that always shows the period's real saved time.
function getDefaultStartTime(): string {
  const now = new Date();
  let hours = now.getHours();
  let minutes = Math.ceil(now.getMinutes() / 5) * 5;
  if (minutes >= 60) {
    minutes = 0;
    hours = (hours + 1) % 24;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function addMinutesToTime(time: string, addMinutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = ((h * 60 + m + addMinutes) % (24 * 60) + 24 * 60) % (24 * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

interface TemplatePeriodRow {
  id: string;
  template_id: string;
  user_id: string;
  name: string;
  category: string | null;
  is_break: boolean;
  start_time: string;
  end_time: string;
  alarm_id: string | null;
  color: string | null;
}

interface TemplateBuilderProps {
  user: any;
  templateId: string | null;
  onBack: () => void;
  styles: AppStyles;
}

export default function TemplateBuilder({
  user,
  templateId,
  onBack,
  styles,
}: TemplateBuilderProps) {
  const { allAlarms, playAlarm } = useAlarms(user?.id);

  const [template, setTemplate] = useState<any>(null);
  const [periods, setPeriods] = useState<TemplatePeriodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<TemplatePeriodRow | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [isBreak, setIsBreak] = useState(false);
  const [startTime, setStartTime] = useState(() => getDefaultStartTime());
  const [endTime, setEndTime] = useState(() => addMinutesToTime(getDefaultStartTime(), 45));
  const [alarmId, setAlarmId] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);

  async function loadTemplate() {
    if (!templateId || !user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    const { data: tmpl, error: tmplError } = await supabase
      .from("timetable_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (tmplError) {
      console.error("Template load error:", tmplError);
      setMessage(tmplError.message);
    } else {
      setTemplate(tmpl);
    }

    const { data: pData, error: pError } = await supabase
      .from("template_periods")
      .select("*")
      .eq("template_id", templateId)
      .order("start_time", { ascending: true });

    if (pError) {
      console.error("Periods load error:", pError);
      setMessage(pError.message);
      setPeriods([]);
    } else {
      setPeriods(pData || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadTemplate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, user?.id]);

  function resetForm() {
    setName("");
    setCategory("");
    setIsBreak(false);
    const defaultStart = getDefaultStartTime();
    setStartTime(defaultStart);
    setEndTime(addMinutesToTime(defaultStart, 45));
    setAlarmId(null);
    setColor(null);
    setEditingPeriod(null);
  }

  function handleOpenAdd() {
    resetForm();
    setShowAddModal(true);
  }

  function handleEditPeriod(p: TemplatePeriodRow) {
    setEditingPeriod(p);
    setName(p.name || "");
    setCategory(p.category || "");
    setIsBreak(Boolean(p.is_break));
    const fallbackStart = getDefaultStartTime();
    setStartTime(p.start_time?.slice(0, 5) || fallbackStart);
    setEndTime(p.end_time?.slice(0, 5) || addMinutesToTime(fallbackStart, 45));
    setAlarmId(p.alarm_id || null);
    setColor(p.color || null);
    setShowAddModal(true);
  }

  async function handleSavePeriod(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setMessage("Please enter a period name.");
      return;
    }
    if (!templateId || !user?.id) {
      setMessage("Missing template or user context.");
      return;
    }
    if (endTime <= startTime) {
      setMessage("End time must be later than start time.");
      return;
    }

    setSaving(true);
    setMessage("");

    const periodData = {
      template_id: templateId,
      user_id: user.id,
      name: name.trim(),
      category: isBreak ? category.trim() || "Break" : category.trim() || name.trim(),
      is_break: isBreak,
      start_time: startTime,
      end_time: endTime,
      alarm_id: alarmId,
      color: color,
    };

    if (editingPeriod) {
      const { data, error } = await supabase
        .from("template_periods")
        .update(periodData)
        .eq("id", editingPeriod.id)
        .select()
        .single();

      if (error) {
        console.error("Period update error:", error);
        setMessage(error.message);
        setSaving(false);
        return;
      }

      setPeriods((prev) =>
        prev
          .map((p) => (p.id === editingPeriod.id ? (data as TemplatePeriodRow) : p))
          .sort((a, b) => a.start_time.localeCompare(b.start_time))
      );
    } else {
      const { data, error } = await supabase
        .from("template_periods")
        .insert(periodData)
        .select()
        .single();

      if (error) {
        console.error("Period insert error:", error);
        setMessage(error.message);
        setSaving(false);
        return;
      }

      setPeriods((prev) =>
        [...prev, data as TemplatePeriodRow].sort((a, b) => a.start_time.localeCompare(b.start_time))
      );
    }

    setSaving(false);
    setShowAddModal(false);
    resetForm();
  }

  async function handleDeletePeriod(pId: string) {
    const { error } = await supabase.from("template_periods").delete().eq("id", pId);

    if (error) {
      console.error("Period delete error:", error);
      setMessage(error.message);
      return;
    }

    setPeriods((prev) => prev.filter((p) => p.id !== pId));
  }

  return (
    <div style={styles.page}>
      <main style={styles.dashboard}>
        <button type="button" style={styles.backButton} onClick={onBack}>
          ← Back to Planner
        </button>

        <div style={styles.timerHeader}>
          <p style={styles.eyebrow}>TIMETABLE BUILDER</p>
          <h1 style={styles.routineTitle}>{template?.name || "Timetable"}</h1>
          <p style={styles.cardText}>
            Configure your scheduled periods and breaks in this timetable.
          </p>
        </div>

        {message && <p style={styles.message}>{message}</p>}

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "16px" }}>
          <button
            type="button"
            style={{
              ...styles.primary,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              width: "auto",
              padding: "12px 20px",
            }}
            onClick={handleOpenAdd}
          >
            <PlusIcon width={16} height={16} />
            Add Period
          </button>
        </div>

        {loading ? (
          <div style={styles.timerInfoCard}>
            <p style={styles.cardText}>Loading periods...</p>
          </div>
        ) : periods.length === 0 ? (
          <div style={styles.timerInfoCard}>
            <p style={styles.cardText}>No periods in this timetable yet.</p>
            <p style={styles.tipText}>
              Tap "Add Period" to build your daily study schedule.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {periods.map((p) => (
              <div
                key={p.id}
                style={{
                  padding: "16px",
                  borderRadius: "16px",
                  background: "#11191c",
                  border: "1px solid #202c30",
                  borderLeft: `4px solid ${p.color || (p.is_break ? "#e8c468" : "#58d8c4")}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "12px",
                      background: p.is_break ? "#192d2b" : "#13332e",
                      color: "#58d8c4",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {p.is_break ? <CoffeeIcon width={16} height={16} /> : <ClockIcon width={16} height={16} />}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: "0 0 3px", fontWeight: 800, fontSize: "15px" }}>{p.name}</p>
                    <p style={{ margin: 0, fontSize: "12px", color: "#829096" }}>
                      {p.category} · {formatTime(p.start_time)} – {formatTime(p.end_time)}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  <button
                    type="button"
                    style={{
                      padding: "8px 12px",
                      borderRadius: "10px",
                      border: "1px solid #293438",
                      background: "#0d1416",
                      color: "#e8edef",
                      fontSize: "12px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                    onClick={() => handleEditPeriod(p)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    style={{
                      padding: "8px",
                      borderRadius: "10px",
                      border: "1px solid #382424",
                      background: "#180e0e",
                      color: "#ff8f8f",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    onClick={() => handleDeletePeriod(p.id)}
                    aria-label="Delete period"
                  >
                    <TrashIcon width={14} height={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODAL: ADD / EDIT PERIOD */}
        {showAddModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(4, 7, 8, 0.75)",
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "center",
              zIndex: 300,
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "480px",
                background: "#0d1416",
                borderTop: "1px solid #202c30",
                borderTopLeftRadius: "26px",
                borderTopRightRadius: "26px",
                padding: "26px 20px calc(30px + env(safe-area-inset-bottom))",
                boxSizing: "border-box",
                maxHeight: "90vh",
                overflowY: "auto",
              }}
            >
              <h2 style={{ margin: "0 0 16px", fontSize: "20px" }}>
                {editingPeriod ? "Edit Period" : "Add Period"}
              </h2>

              <form onSubmit={handleSavePeriod}>
                {/* TYPE SELECTOR */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                  <button
                    type="button"
                    onClick={() => setIsBreak(false)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "12px",
                      border: !isBreak ? "1px solid #58d8c4" : "1px solid #293438",
                      background: !isBreak ? "#19322f" : "#11191c",
                      color: !isBreak ? "#63d8c7" : "#9ba8ad",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    Study Period
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBreak(true)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: "12px",
                      border: isBreak ? "1px solid #58d8c4" : "1px solid #293438",
                      background: isBreak ? "#19322f" : "#11191c",
                      color: isBreak ? "#63d8c7" : "#9ba8ad",
                      fontWeight: 700,
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    Break
                  </button>
                </div>

                <label style={styles.label}>Period Name</label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="e.g. Physics Problem Solving, Lunch Break"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />

                {!isBreak && (
                  <>
                    <label style={styles.label}>Subject</label>
                    <input
                      style={styles.input}
                      type="text"
                      placeholder="e.g. Physics, History"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    />
                  </>
                )}

                <div style={styles.plannerTwoColumn}>
                  <div>
                    <label style={styles.label}>Start Time</label>
                    <input
                      style={styles.input}
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label style={styles.label}>End Time</label>
                    <input
                      style={styles.input}
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <AlarmSelector
                    allAlarms={allAlarms}
                    value={alarmId}
                    onChange={setAlarmId}
                    onPreview={playAlarm}
                    styles={styles}
                    label="COMPLETION ALARM"
                  />
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <ColorSelector
                    value={color}
                    onChange={setColor}
                    styles={styles}
                    label="PERIOD COLOR"
                  />
                </div>

                <button style={styles.primary} type="submit" disabled={saving}>
                  {saving ? "Saving..." : editingPeriod ? "Save Changes" : "Add to Timetable"}
                </button>

                <button
                  type="button"
                  style={{ ...styles.secondary, marginTop: "10px" }}
                  onClick={() => setShowAddModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}