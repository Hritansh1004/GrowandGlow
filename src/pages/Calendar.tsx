import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { AppStyles } from "../hooks/useStyles";
import { useTheme } from "../context/ThemeContext";
import { getThemeColors } from "../styles/theme";
import useAlarms from "../hooks/useAlarms";
import AlarmSelector from "../components/AlarmSelector";
import ColorSelector from "../components/ColorSelector";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
} from "../components/Icons";

// No hardcoded clock default (e.g. a fixed "09:00") — a brand-new one-off
// period should default to the actual current time, rounded up to the
// next 5 minutes, so the time picker opens near "now" instead of always
// jumping to 9 AM regardless of when it actually is.
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

interface CalendarProps {
  user: any;
  onBack: () => void;
  styles: AppStyles;
}

interface OneOffPeriodRow {
  id: string;
  override_id: string;
  user_id: string;
  name: string;
  category: string | null;
  is_break: boolean;
  start_time: string;
  end_time: string;
  alarm_id: string | null;
  color: string | null;
  sort_order: number;
}

interface OverrideEntry {
  id: string; // calendar_overrides.id
  override_type: "template" | "holiday" | "one_off";
  template_id: string | null;
}

export default function Calendar({ user, onBack, styles }: CalendarProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { allAlarms, playAlarm } = useAlarms(user?.id);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [templates, setTemplates] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<Record<string, OverrideEntry>>({});
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [selectedCustomPeriods, setSelectedCustomPeriods] = useState<OneOffPeriodRow[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Custom one-off period add form
  const [showCustomPeriodForm, setShowCustomPeriodForm] = useState(false);
  const [customPeriodName, setCustomPeriodName] = useState("");
  const [customPeriodCategory, setCustomPeriodCategory] = useState("Study");
  const [customPeriodStart, setCustomPeriodStart] = useState(() => getDefaultStartTime());
  const [customPeriodEnd, setCustomPeriodEnd] = useState(() => addMinutesToTime(getDefaultStartTime(), 60));
  const [customPeriodIsBreak, setCustomPeriodIsBreak] = useState(false);
  const [customPeriodAlarmId, setCustomPeriodAlarmId] = useState<string | null>(null);
  const [customPeriodColor, setCustomPeriodColor] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  }

  async function loadOverridesAndTemplates() {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const { data: tmplData, error: tmplError } = await supabase
      .from("timetable_templates")
      .select("id, name")
      .eq("user_id", user.id);

    if (tmplError) {
      console.error("Templates load error:", tmplError);
      setErrorMessage(tmplError.message);
    }
    setTemplates(tmplData || []);

    const { data: ovData, error: ovError } = await supabase
      .from("calendar_overrides")
      .select("*")
      .eq("user_id", user.id);

    if (ovError) {
      console.error("calendar_overrides load error:", ovError);
      setErrorMessage(ovError.message);
    }

    const map: Record<string, OverrideEntry> = {};
    (ovData || []).forEach((row: any) => {
      map[row.override_date] = {
        id: row.id,
        override_type: row.override_type,
        template_id: row.template_id || null,
      };
    });

    setOverrides(map);
    setLoading(false);
  }

  useEffect(() => {
    loadOverridesAndTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function loadCustomPeriodsForDate(overrideId: string) {
    setPeriodsLoading(true);
    const { data, error } = await supabase
      .from("one_off_periods")
      .select("*")
      .eq("override_id", overrideId)
      .order("sort_order", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      console.error("one_off_periods load error:", error);
      setErrorMessage(error.message);
      setSelectedCustomPeriods([]);
    } else {
      setSelectedCustomPeriods((data as OneOffPeriodRow[]) || []);
    }
    setPeriodsLoading(false);
  }

  function handleSelectDate(dateStr: string) {
    setSelectedDateStr(dateStr);
    setShowCustomPeriodForm(false);
    setErrorMessage("");

    const existing = overrides[dateStr];
    if (existing && existing.override_type === "one_off") {
      loadCustomPeriodsForDate(existing.id);
    } else {
      setSelectedCustomPeriods([]);
    }
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const paddingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const monthName = currentDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  // Ensures a calendar_overrides row exists for the given date with the
  // given type, and returns its id. Used both for direct template/holiday
  // assignment and as the parent row for one-off periods.
  async function ensureOverrideRow(
    dateStr: string,
    overrideType: "template" | "holiday" | "one_off",
    templateId: string | null
  ): Promise<{ id: string } | null> {
    const { data, error } = await supabase
      .from("calendar_overrides")
      .upsert(
        {
          user_id: user.id,
          override_date: dateStr,
          override_type: overrideType,
          template_id: templateId,
        },
        { onConflict: "user_id,override_date" }
      )
      .select()
      .single();

    if (error) {
      console.error("calendar_overrides upsert error:", error);
      setErrorMessage(error.message);
      return null;
    }

    return data;
  }

  async function handleAssignTemplate(dateStr: string, templateId: string | null) {
    setSaving(true);
    setErrorMessage("");

    if (!templateId) {
      await handleResetDate(dateStr);
      setSaving(false);
      return;
    }

    const row = await ensureOverrideRow(dateStr, "template", templateId);
    setSaving(false);

    if (row) {
      setOverrides((prev) => ({
        ...prev,
        [dateStr]: { id: row.id, override_type: "template", template_id: templateId },
      }));
      showToast("Timetable assigned to this date.");
    }
  }

  async function handleToggleHoliday(dateStr: string, isHoliday: boolean) {
    setSaving(true);
    setErrorMessage("");

    if (!isHoliday) {
      await handleResetDate(dateStr);
      setSaving(false);
      return;
    }

    const row = await ensureOverrideRow(dateStr, "holiday", null);
    setSaving(false);

    if (row) {
      setOverrides((prev) => ({
        ...prev,
        [dateStr]: { id: row.id, override_type: "holiday", template_id: null },
      }));
      setSelectedCustomPeriods([]);
      showToast("Marked as Holiday / Rest Day.");
    }
  }

  async function handleResetDate(dateStr: string) {
    setErrorMessage("");
    const existing = overrides[dateStr];

    const { error } = await supabase
      .from("calendar_overrides")
      .delete()
      .eq("user_id", user.id)
      .eq("override_date", dateStr);

    if (error) {
      console.error("calendar_overrides delete error:", error);
      setErrorMessage(error.message);
      return;
    }

    // Best-effort cleanup of the legacy duplicate tables from earlier schema
    // versions, so stale rows there can't confuse anything else that still
    // reads them.
    try {
      await supabase.from("date_overrides").delete().eq("user_id", user.id).eq("override_date", dateStr);
    } catch {}

    setOverrides((prev) => {
      const updated = { ...prev };
      delete updated[dateStr];
      return updated;
    });
    setSelectedCustomPeriods([]);
    if (existing) showToast(`Reset ${dateStr} to default weekly timetable.`);
  }

  async function handleAddCustomPeriod() {
    if (!selectedDateStr || !user?.id) return;

    if (customPeriodEnd <= customPeriodStart) {
      setErrorMessage("End time must be later than start time.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    let overrideEntry = overrides[selectedDateStr];

    // Make sure the parent calendar_overrides row exists and is typed
    // 'one_off' before we can attach a period to it.
    if (!overrideEntry || overrideEntry.override_type !== "one_off") {
      const row = await ensureOverrideRow(selectedDateStr, "one_off", null);
      if (!row) {
        setSaving(false);
        return;
      }
      overrideEntry = { id: row.id, override_type: "one_off", template_id: null };
      setOverrides((prev) => ({ ...prev, [selectedDateStr]: overrideEntry! }));
    }

    const newPeriod = {
      override_id: overrideEntry.id,
      user_id: user.id,
      name: customPeriodName.trim() || (customPeriodIsBreak ? "Break" : "Study Session"),
      category: customPeriodIsBreak ? customPeriodCategory.trim() || "Break" : customPeriodCategory.trim() || "General",
      is_break: customPeriodIsBreak,
      start_time: customPeriodStart,
      end_time: customPeriodEnd,
      alarm_id: customPeriodAlarmId,
      color: customPeriodColor,
      sort_order: selectedCustomPeriods.length,
    };

    const { data, error } = await supabase
      .from("one_off_periods")
      .insert(newPeriod)
      .select()
      .single();

    setSaving(false);

    if (error) {
      console.error("one_off_periods insert error:", error);
      setErrorMessage(error.message);
      return;
    }

    setSelectedCustomPeriods((prev) =>
      [...prev, data as OneOffPeriodRow].sort((a, b) => a.start_time.localeCompare(b.start_time))
    );

    setCustomPeriodName("");
    const resetStart = getDefaultStartTime();
    setCustomPeriodStart(resetStart);
    setCustomPeriodEnd(addMinutesToTime(resetStart, 60));
    setCustomPeriodIsBreak(false);
    setCustomPeriodAlarmId(null);
    setCustomPeriodColor(null);
    setShowCustomPeriodForm(false);
    showToast("Period added to this date's custom schedule.");
  }

  async function handleRemoveCustomPeriod(periodId: string) {
    setErrorMessage("");

    const { error } = await supabase.from("one_off_periods").delete().eq("id", periodId);

    if (error) {
      console.error("one_off_periods delete error:", error);
      setErrorMessage(error.message);
      return;
    }

    setSelectedCustomPeriods((prev) => prev.filter((p) => p.id !== periodId));
  }

  const selectedOverride = selectedDateStr ? overrides[selectedDateStr] : null;
  const isHoliday = selectedOverride?.override_type === "holiday";
  const isOneOff = selectedOverride?.override_type === "one_off";

  return (
    <div style={{ ...styles.page, background: colors.bg, minHeight: "100vh", color: colors.text }}>
      <main style={{ ...styles.dashboard, maxWidth: "680px", margin: "0 auto", padding: "16px 16px 80px" }}>
        {/* BACK BUTTON */}
        <button
          type="button"
          style={{
            ...styles.backButton,
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: colors.card,
            border: `1px solid ${colors.border}`,
            color: colors.text,
          }}
          onClick={onBack}
        >
          <ArrowLeftIcon />
          Back to Planner
        </button>

        {/* HEADER */}
        <div style={styles.timerHeader}>
          <p style={styles.eyebrow}>CALENDAR OVERRIDES</p>
          <h1 style={{ ...styles.routineTitle, color: colors.text }}>Specific Date Timetables</h1>
          <p style={{ ...styles.cardText, color: colors.textDim }}>
            Select any date to assign a template, mark a holiday, or build a custom one-off timetable for that exact day.
          </p>
        </div>

        {toastMessage && (
          <div
            style={{
              padding: "10px 16px",
              marginBottom: "14px",
              borderRadius: "12px",
              background: colors.accentDim,
              border: `1px solid ${colors.accent}`,
              color: colors.accent,
              fontSize: "13px",
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            {toastMessage}
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              padding: "10px 16px",
              marginBottom: "14px",
              borderRadius: "12px",
              background: "rgba(255, 143, 143, 0.1)",
              border: "1px solid rgba(255, 143, 143, 0.3)",
              color: colors.danger,
              fontSize: "13px",
              fontWeight: 700,
              textAlign: "center",
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* MONTH HEADER */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
            padding: "12px 16px",
            borderRadius: "16px",
            background: colors.card,
            border: `1px solid ${colors.border}`,
          }}
        >
          <button
            type="button"
            style={{
              padding: "8px",
              borderRadius: "10px",
              background: "transparent",
              border: "none",
              color: colors.text,
              cursor: "pointer",
              display: "flex",
            }}
            onClick={prevMonth}
            aria-label="Previous Month"
          >
            <ChevronLeftIcon width={18} height={18} />
          </button>

          <strong style={{ fontSize: "16px", color: colors.text }}>{monthName}</strong>

          <button
            type="button"
            style={{
              padding: "8px",
              borderRadius: "10px",
              background: "transparent",
              border: "none",
              color: colors.text,
              cursor: "pointer",
              display: "flex",
            }}
            onClick={nextMonth}
            aria-label="Next Month"
          >
            <ChevronRightIcon width={18} height={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: "20px", textAlign: "center", color: colors.textDim }}>Loading calendar...</div>
        ) : (
          <>
            {/* CALENDAR GRID */}
            <div style={{ padding: "16px", borderRadius: "18px", background: colors.card, border: `1px solid ${colors.border}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", marginBottom: "8px" }}>
                {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                  <span key={i} style={{ fontSize: "11px", color: colors.textDim, fontWeight: 800 }}>
                    {d}
                  </span>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
                {Array.from({ length: paddingDays }).map((_, i) => (
                  <div key={`pad-${i}`} style={{ height: "42px" }} />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const isSelected = selectedDateStr === dateStr;
                  const override = overrides[dateStr];

                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleSelectDate(dateStr)}
                      style={{
                        height: "42px",
                        borderRadius: "12px",
                        border: isSelected ? `2px solid ${colors.accent}` : `1px solid ${colors.border}`,
                        background: isSelected
                          ? colors.accentDim
                          : override?.override_type === "holiday"
                          ? "rgba(255, 143, 143, 0.12)"
                          : override
                          ? colors.cardAlt
                          : "transparent",
                        color: isSelected
                          ? colors.accent
                          : override?.override_type === "holiday"
                          ? colors.danger
                          : override
                          ? colors.accent
                          : colors.text,
                        fontWeight: 700,
                        fontSize: "13px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {day}
                      {override && (
                        <span
                          style={{
                            width: "5px",
                            height: "5px",
                            borderRadius: "50%",
                            background: override.override_type === "holiday" ? colors.danger : colors.accent,
                            marginTop: "2px",
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SELECTED DATE DETAIL & TIMETABLE BUILDER */}
            {selectedDateStr && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "20px",
                  borderRadius: "20px",
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <div>
                    <p style={{ ...styles.cardLabel, color: colors.accent, margin: "0 0 2px" }}>SELECTED DATE</p>
                    <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: colors.text }}>
                      {new Date(`${selectedDateStr}T00:00:00`).toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </h3>
                  </div>

                  {selectedOverride && (
                    <button
                      type="button"
                      onClick={() => handleResetDate(selectedDateStr)}
                      disabled={saving}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "10px",
                        background: "rgba(255, 143, 143, 0.1)",
                        border: "1px solid rgba(255, 143, 143, 0.3)",
                        color: colors.danger,
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Reset Date
                    </button>
                  )}
                </div>

                {/* HOLIDAY TOGGLE */}
                <div style={{ padding: "12px 14px", borderRadius: "14px", background: colors.cardAlt, border: `1px solid ${colors.border}`, marginBottom: "14px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontWeight: 700, cursor: "pointer", color: colors.text }}>
                    <input
                      type="checkbox"
                      checked={isHoliday}
                      disabled={saving}
                      onChange={(e) => handleToggleHoliday(selectedDateStr, e.target.checked)}
                      style={{ width: "18px", height: "18px", accentColor: colors.accent }}
                    />
                    <span>Mark as Holiday / Rest Day (No Timetable)</span>
                  </label>
                </div>

                {!isHoliday && (
                  <>
                    {/* ASSIGN TEMPLATE OPTION */}
                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ ...styles.label, color: colors.textDim }}>Assign a Saved Timetable Preset</label>
                      <select
                        style={{ ...styles.input, background: colors.cardAlt, border: `1px solid ${colors.border}`, color: colors.text, marginBottom: 0 }}
                        value={selectedOverride?.override_type === "template" ? selectedOverride.template_id || "" : ""}
                        disabled={saving}
                        onChange={(e) => handleAssignTemplate(selectedDateStr, e.target.value || null)}
                      >
                        <option value="">Default Weekly Schedule</option>
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* ONE-OFF CUSTOM PERIODS */}
                    <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: "14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <div>
                          <p style={{ ...styles.cardLabel, color: colors.accent, margin: "0 0 2px" }}>
                            CUSTOM PERIODS FOR THIS DAY
                          </p>
                          <span style={{ fontSize: "12px", color: colors.textDim }}>
                            {periodsLoading ? "Loading..." : `${selectedCustomPeriods.length} Custom Period(s)`}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setShowCustomPeriodForm(!showCustomPeriodForm)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "10px",
                            background: colors.accentDim,
                            border: `1px solid ${colors.accent}`,
                            color: colors.accent,
                            fontSize: "12px",
                            fontWeight: 800,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <PlusIcon width={13} height={13} />
                          Add Period
                        </button>
                      </div>

                      {selectedCustomPeriods.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
                          {selectedCustomPeriods.map((p) => (
                            <div
                              key={p.id}
                              style={{
                                padding: "10px 14px",
                                borderRadius: "12px",
                                background: colors.cardAlt,
                                border: `1px solid ${colors.border}`,
                                borderLeft: `4px solid ${p.color || (p.is_break ? colors.warning : colors.accent)}`,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                              }}
                            >
                              <div>
                                <p style={{ margin: "0 0 2px", fontWeight: 800, fontSize: "13px", color: colors.text }}>
                                  {p.name}
                                </p>
                                <p style={{ margin: 0, fontSize: "12px", color: colors.textDim }}>
                                  {p.start_time?.slice(0, 5)} – {p.end_time?.slice(0, 5)} · {p.category}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveCustomPeriod(p.id)}
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: colors.danger,
                                  cursor: "pointer",
                                  padding: "4px",
                                }}
                                aria-label="Remove Period"
                              >
                                <TrashIcon width={15} height={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {showCustomPeriodForm && (
                        <div
                          style={{
                            padding: "14px",
                            borderRadius: "14px",
                            background: colors.cardAlt,
                            border: `1px solid ${colors.border}`,
                            marginTop: "10px",
                          }}
                        >
                          <div style={{ marginBottom: "10px" }}>
                            <label style={{ ...styles.label, color: colors.textDim }}>Period Name</label>
                            <input
                              type="text"
                              placeholder="e.g. Physics Revision or Mock Test"
                              value={customPeriodName}
                              onChange={(e) => setCustomPeriodName(e.target.value)}
                              style={{ ...styles.input, background: colors.card, border: `1px solid ${colors.border}`, color: colors.text }}
                            />
                          </div>

                          <div style={{ marginBottom: "10px" }}>
                            <label style={{ ...styles.label, color: colors.textDim }}>Subject / Category</label>
                            <input
                              type="text"
                              placeholder="e.g. Physics, Break"
                              value={customPeriodCategory}
                              onChange={(e) => setCustomPeriodCategory(e.target.value)}
                              style={{ ...styles.input, background: colors.card, border: `1px solid ${colors.border}`, color: colors.text }}
                            />
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                            <div>
                              <label style={{ ...styles.label, color: colors.textDim }}>Start Time</label>
                              <input
                                type="time"
                                value={customPeriodStart}
                                onChange={(e) => setCustomPeriodStart(e.target.value)}
                                style={{ ...styles.input, background: colors.card, border: `1px solid ${colors.border}`, color: colors.text }}
                              />
                            </div>
                            <div>
                              <label style={{ ...styles.label, color: colors.textDim }}>End Time</label>
                              <input
                                type="time"
                                value={customPeriodEnd}
                                onChange={(e) => setCustomPeriodEnd(e.target.value)}
                                style={{ ...styles.input, background: colors.card, border: `1px solid ${colors.border}`, color: colors.text }}
                              />
                            </div>
                          </div>

                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              margin: "0 0 12px",
                              fontSize: "13px",
                              fontWeight: 700,
                              cursor: "pointer",
                              color: colors.text,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={customPeriodIsBreak}
                              onChange={(e) => setCustomPeriodIsBreak(e.target.checked)}
                              style={{ width: "18px", height: "18px", accentColor: colors.accent }}
                            />
                            <span>Mark as Break</span>
                          </label>

                          <div style={{ marginBottom: "16px" }}>
                            <AlarmSelector
                              allAlarms={allAlarms}
                              value={customPeriodAlarmId}
                              onChange={setCustomPeriodAlarmId}
                              onPreview={playAlarm}
                              styles={styles}
                              label="ALARM FOR THIS PERIOD"
                            />
                          </div>

                          <div style={{ marginBottom: "16px" }}>
                            <ColorSelector
                              value={customPeriodColor}
                              onChange={setCustomPeriodColor}
                              styles={styles}
                              label="COLOR FOR THIS PERIOD"
                            />
                          </div>

                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={handleAddCustomPeriod}
                              disabled={saving}
                              style={{
                                ...styles.primary,
                                flex: 1,
                                background: colors.accent,
                                color: colors.accentText,
                                fontWeight: 800,
                              }}
                            >
                              {saving ? "Saving..." : "Save Period"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowCustomPeriodForm(false)}
                              disabled={saving}
                              style={{
                                ...styles.secondary,
                                background: colors.card,
                                color: colors.textDim,
                                border: `1px solid ${colors.border}`,
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}