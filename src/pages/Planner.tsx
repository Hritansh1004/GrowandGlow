import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { AppStyles } from "../hooks/useStyles";
import { useTheme } from "../context/ThemeContext";
import { getThemeColors } from "../styles/theme";
import useAlarms from "../hooks/useAlarms";
import AlarmSelector from "../components/AlarmSelector";
import ColorSelector from "../components/ColorSelector";
import RatingModal from "../components/RatingModal";
import type { PlannerItem } from "../hooks/usePlanner";
import {
  CalendarIcon,
  PlusIcon,
  TrashIcon,
  MoreIcon,
  ClockIcon,
  CoffeeIcon,
  CheckIcon,
  SaveIcon,
  XIcon,
} from "../components/Icons";

function formatDate(date: string) {
  if (!date) return "";
  const value = new Date(`${date}T00:00:00`);
  return value.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(time: string) {
  if (!time) return "";
  const [hours, minutes] = time.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function groupHeaderLabel(dateString: string) {
  const today = todayStr();
  const d = new Date(`${dateString}T00:00:00`);
  const t = new Date(`${today}T00:00:00`);
  const diffDays = Math.round((d.getTime() - t.getTime()) / 86400000);

  if (diffDays === 0) return `Today · ${formatDate(dateString)}`;
  if (diffDays === 1) return `Tomorrow · ${formatDate(dateString)}`;
  if (diffDays === -1) return `Yesterday · ${formatDate(dateString)}`;
  return formatDate(dateString);
}

function sourceTag(source: PlannerItem["source"]) {
  if (source === "planner") return "Planner";
  if (source === "one_off") return "Custom Schedule";
  return "Timetable";
}

type PlanFilter = "today" | "upcoming" | "all";

interface PlannerProps {
  user: any;
  plannerTasks?: any[];
  plannerTitle: string;
  plannerSubject: string;
  plannerDate: string;
  plannerStartTime: string;
  plannerEndTime: string;
  plannerAlarmId: string | null;
  plannerColor?: string | null;
  setPlannerTitle: (val: string) => void;
  setPlannerSubject: (val: string) => void;
  setPlannerDate: (val: string) => void;
  setPlannerStartTime: (val: string) => void;
  setPlannerEndTime: (val: string) => void;
  setPlannerAlarmId: (val: string | null) => void;
  setPlannerColor?: (val: string | null) => void;
  plannerLoading: boolean;
  plannerMessage: string;
  editingTask: any;
  addPlannerTask: (e: React.FormEvent) => Promise<void>;
  editPlannerTask: (task: any) => void;
  updatePlannerTask: (task: any) => Promise<void>;
  togglePlannerTask: (task: any) => Promise<void>;
  deletePlannerTask: (id: string) => Promise<void>;
  clearPlannerForm: () => void;
  setPage: (page: string) => void;
  openTemplateBuilder: (id: string) => void;
  styles: AppStyles;

  // Merged multi-source list (periods + planner tasks, across dates)
  plannerItems?: PlannerItem[];
  plannerItemsLoading?: boolean;
  plannerItemsMessage?: string;
  editPlannerItem?: (item: PlannerItem, changes: any) => Promise<any>;
  deletePlannerItem?: (item: PlannerItem) => Promise<any>;
  togglePlannerItemComplete?: (item: PlannerItem) => Promise<any>;
  submitPlannerItemRatingAction?: (item: PlannerItem, rating: number, note?: string) => Promise<any>;
}

export default function Planner({
  user,
  plannerTitle,
  plannerSubject,
  plannerDate,
  plannerStartTime,
  plannerEndTime,
  plannerAlarmId,
  plannerColor = null,
  setPlannerTitle,
  setPlannerSubject,
  setPlannerDate,
  setPlannerStartTime,
  setPlannerEndTime,
  setPlannerAlarmId,
  setPlannerColor,
  plannerLoading,
  plannerMessage,
  editingTask,
  addPlannerTask,
  editPlannerTask,
  updatePlannerTask,
  clearPlannerForm,
  setPage,
  openTemplateBuilder,
  styles,
  plannerItems = [],
  plannerItemsLoading = false,
  plannerItemsMessage = "",
  editPlannerItem,
  deletePlannerItem,
  togglePlannerItemComplete,
  submitPlannerItemRatingAction,
}: PlannerProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { allAlarms, playAlarm } = useAlarms(user?.id);

  const isEditing = Boolean(editingTask);

  const [templates, setTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templateMessage, setTemplateMessage] = useState("");
  const [showCreator, setShowCreator] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Filter for the merged "YOUR PLAN" list. Defaults to "upcoming" so
  // old past dates (which are kept around on purpose so nothing is ever
  // silently dropped — see usePlanner.ts) don't clutter the default view.
  const [planFilter, setPlanFilter] = useState<PlanFilter>("upcoming");

  // Edit modal for merged items (planner task / one-off period / template period)
  const [editingItem, setEditingItem] = useState<PlannerItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editAlarmId, setEditAlarmId] = useState<string | null>(null);
  const [editColor, setEditColor] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const [ratingTargetItem, setRatingTargetItem] = useState<PlannerItem | null>(null);

  async function loadTemplates() {
    if (!user?.id) {
      setTemplates([]);
      setTemplatesLoading(false);
      return;
    }

    setTemplatesLoading(true);

    try {
      const { data, error } = await supabase
        .from("timetable_templates")
        .select("id, name, description, created_at, periods:template_periods(id)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setTemplates(data);
      } else {
        const saved = localStorage.getItem(`benchmate_templates_${user.id}`);
        setTemplates(saved ? JSON.parse(saved) : []);
      }
    } catch {
      const saved = localStorage.getItem(`benchmate_templates_${user.id}`);
      setTemplates(saved ? JSON.parse(saved) : []);
    } finally {
      setTemplatesLoading(false);
    }
  }

  useEffect(() => {
    loadTemplates();
  }, [user?.id]);

  useEffect(() => {
    function closeMenu() {
      setMenuOpenId(null);
    }
    if (menuOpenId !== null) {
      document.addEventListener("click", closeMenu);
    }
    return () => document.removeEventListener("click", closeMenu);
  }, [menuOpenId]);

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id) return;

    const cleanName = templateName.trim();
    if (!cleanName) return;

    setCreating(true);
    setTemplateMessage("");

    const newTmpl: any = {
      id: `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_id: user.id,
      name: cleanName,
      created_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from("timetable_templates")
        .insert({ user_id: user.id, name: cleanName })
        .select("id, name, description, created_at")
        .single();

      const created = (!error && data ? data : newTmpl);
      setTemplates((prev) => {
        const updated = [...prev, { ...created, periods: [] }];
        localStorage.setItem(`benchmate_templates_${user.id}`, JSON.stringify(updated));
        return updated;
      });

      setTemplateName("");
      setShowCreator(false);
      openTemplateBuilder(created.id);
    } catch {
      setTemplates((prev) => {
        const updated = [...prev, { ...newTmpl, periods: [] }];
        localStorage.setItem(`benchmate_templates_${user.id}`, JSON.stringify(updated));
        return updated;
      });
      setTemplateName("");
      setShowCreator(false);
      openTemplateBuilder(newTmpl.id);
    } finally {
      setCreating(false);
    }
  }

  async function renameTemplate(template: any) {
    const nextName = window.prompt("New timetable name:", template.name);
    if (nextName === null) return;
    const cleanName = nextName.trim();
    if (!cleanName) return;

    try {
      await supabase
        .from("timetable_templates")
        .update({ name: cleanName })
        .eq("id", template.id)
        .eq("user_id", user.id);
    } catch {}

    setTemplates((prev) => {
      const updated = prev.map((t) => (t.id === template.id ? { ...t, name: cleanName } : t));
      localStorage.setItem(`benchmate_templates_${user.id}`, JSON.stringify(updated));
      return updated;
    });
    setMenuOpenId(null);
  }

  async function duplicateTemplate(template: any) {
    setTemplatesLoading(true);
    const newTmpl: any = {
      id: `tmpl_${Date.now()}`,
      user_id: user.id,
      name: `${template.name} Copy`,
      created_at: new Date().toISOString(),
      periods: template.periods || [],
    };

    try {
      const { data } = await supabase
        .from("timetable_templates")
        .insert({ user_id: user.id, name: `${template.name} Copy` })
        .select("id, name, description, created_at")
        .single();

      const created = data || newTmpl;
      setTemplates((prev) => {
        const updated = [...prev, created];
        localStorage.setItem(`benchmate_templates_${user.id}`, JSON.stringify(updated));
        return updated;
      });
    } catch {
      setTemplates((prev) => [...prev, newTmpl]);
    } finally {
      setTemplatesLoading(false);
      setMenuOpenId(null);
    }
  }

  async function deleteTemplate(template: any) {
    const confirmed = window.confirm(`Delete "${template.name}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      await supabase.from("timetable_templates").delete().eq("id", template.id).eq("user_id", user.id);
    } catch {}

    setTemplates((prev) => {
      const updated = prev.filter((t) => t.id !== template.id);
      localStorage.setItem(`benchmate_templates_${user.id}`, JSON.stringify(updated));
      return updated;
    });
    setMenuOpenId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEditing) {
      await updatePlannerTask(editingTask);
    } else {
      await addPlannerTask(e);
    }
  }

  function handleEdit(task: any) {
    editPlannerTask(task);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openItemEdit(item: PlannerItem) {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditSubject(item.subject);
    setEditStart(item.time);
    setEditEnd(item.end);
    setEditAlarmId(item.alarmId || null);
    setEditColor(item.color || null);
    setEditError("");
  }

  function closeItemEdit() {
    setEditingItem(null);
    setEditError("");
  }

  async function handleSaveItemEdit() {
    if (!editingItem || !editPlannerItem) return;

    if (!editTitle.trim()) {
      setEditError("Title cannot be blank.");
      return;
    }
    if (!editStart || !editEnd) {
      setEditError("Start and end time cannot be blank.");
      return;
    }
    if (editEnd <= editStart) {
      setEditError("End time must be later than start time.");
      return;
    }

    setEditSaving(true);
    setEditError("");

    const changes: any = {
      title: editTitle.trim(),
      subject: editSubject.trim(),
      time: editStart,
      end: editEnd,
    };
    changes.alarmId = editAlarmId;
    changes.color = editColor;

    const res = await editPlannerItem(editingItem, changes);
    setEditSaving(false);

    if (!res?.success) {
      setEditError(res?.error || "Could not save changes.");
      return;
    }

    closeItemEdit();
  }

  async function handleDeleteItem(item: PlannerItem) {
    if (!deletePlannerItem) return;
    const confirmed = window.confirm(`Delete "${item.title}"? This cannot be undone.`);
    if (!confirmed) return;
    await deletePlannerItem(item);
  }

  async function handleToggleItemComplete(item: PlannerItem) {
    if (!togglePlannerItemComplete) return;
    await togglePlannerItemComplete(item);
  }

  async function handleRatingSubmit(rating: number, note?: string) {
    if (ratingTargetItem && submitPlannerItemRatingAction) {
      await submitPlannerItemRatingAction(ratingTargetItem, rating, note);
      setRatingTargetItem(null);
    }
  }

  // Group merged items by date for a compact, scannable layout
  const grouped = plannerItems.reduce<Record<string, PlannerItem[]>>((acc, item) => {
    if (!acc[item.dateString]) acc[item.dateString] = [];
    acc[item.dateString].push(item);
    return acc;
  }, {});

  const today = todayStr();

  // Apply the Today / Upcoming / All filter on top of the grouped dates.
  // "today"    -> only the current date
  // "upcoming" -> current date and anything in the future (default —
  //               hides old past dates without ever deleting their data)
  // "all"      -> every date that has anything at all, past or future
  const allSortedDates = Object.keys(grouped).sort();
  const sortedDates = allSortedDates.filter((dateString) => {
    if (planFilter === "today") return dateString === today;
    if (planFilter === "upcoming") return dateString >= today;
    return true;
  });

  const FILTERS: { key: PlanFilter; label: string }[] = [
    { key: "today", label: "Today Only" },
    { key: "upcoming", label: "Upcoming" },
    { key: "all", label: "All (Incl. Past)" },
  ];

  return (
    <div style={styles.page}>
      <main style={styles.dashboard}>
        <button
          type="button"
          style={styles.backButton}
          onClick={() => setPage("dashboard")}
        >
          ← Back to Dashboard
        </button>

        <div style={styles.timerHeader}>
          <p style={styles.eyebrow}>STUDY PLANNER</p>
          <h1 style={styles.routineTitle}>Plan your day.</h1>
          <p style={styles.cardText}>
            Organize study sessions and manage your saved timetables.
          </p>
        </div>

        {/* TEMPLATE LIBRARY */}
        <section style={styles.templateLibraryCard}>
          <div style={styles.templateLibraryHeader}>
            <div style={styles.templateLibraryHeading}>
              <p style={styles.cardLabel}>TIMETABLES</p>
              <h2 style={styles.templateLibraryTitle}>Your templates</h2>
              <p style={styles.templateLibraryDescription}>
                Save reusable timetables and assign them across your week.
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px", flexShrink: 0, flexWrap: "wrap" }}>
              <button
                type="button"
                style={{
                  ...styles.templateCreateButton,
                  background: "transparent",
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
                onClick={() => setPage("calendar")}
              >
                Calendar
              </button>

              <button
                type="button"
                style={{
                  ...styles.templateCreateButton,
                  background: "transparent",
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                }}
                onClick={() => setPage("weekly-schedule")}
              >
                Weekly Schedule
              </button>

              <button
                type="button"
                style={styles.templateCreateButton}
                onClick={() => {
                  setShowCreator((v) => !v);
                  setTemplateMessage("");
                }}
                disabled={templatesLoading}
              >
                + New
              </button>
            </div>
          </div>

          {showCreator && (
            <form onSubmit={createTemplate} style={styles.templateCreator}>
              <p style={styles.templateCreatorLabel}>TIMETABLE NAME</p>
              <input
                style={styles.input}
                type="text"
                placeholder="e.g. School Week, Heavy Revision"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                disabled={creating}
                autoFocus
              />
              <div style={styles.templateCreatorActions}>
                <button style={styles.primary} type="submit" disabled={creating}>
                  {creating ? "Creating..." : "Create & Edit"}
                </button>
                <button
                  type="button"
                  style={styles.secondary}
                  onClick={() => {
                    setShowCreator(false);
                    setTemplateName("");
                  }}
                  disabled={creating}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {templateMessage && <p style={styles.message}>{templateMessage}</p>}

          {templatesLoading ? (
            <div style={styles.templateEmpty}>
              <p style={styles.templateEmptyText}>Loading timetables...</p>
            </div>
          ) : templates.length === 0 ? (
            <div style={styles.templateEmpty}>
              <div style={styles.templateEmptyIcon}>
                <CalendarIcon width={24} height={24} />
              </div>
              <p style={styles.templateEmptyTitle}>No timetables yet</p>
              <p style={styles.templateEmptyText}>
                Create your first timetable and start adding study periods and breaks.
              </p>
              <button
                type="button"
                style={styles.templateEmptyButton}
                onClick={() => setShowCreator(true)}
              >
                + Create first timetable
              </button>
            </div>
          ) : (
            <div style={styles.templateList}>
              {templates.map((template) => {
                const periodCount = template.periods?.length || 0;

                return (
                  <article key={template.id} style={styles.templateCard}>
                    <button
                      type="button"
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        zIndex: 0,
                      }}
                      aria-label={`Open ${template.name}`}
                      onClick={() => openTemplateBuilder(template.id)}
                    />

                    <div
                      style={{
                        ...styles.templateCardIcon,
                        position: "relative",
                        zIndex: 1,
                        pointerEvents: "none",
                      }}
                    >
                      <CalendarIcon width={20} height={20} />
                    </div>

                    <div
                      style={{
                        ...styles.templateCardContent,
                        position: "relative",
                        zIndex: 1,
                        pointerEvents: "none",
                      }}
                    >
                      <p style={styles.templateCardLabel}>TIMETABLE</p>
                      <h3 style={styles.templateCardTitle}>{template.name}</h3>
                      <p style={styles.templateCardMeta}>
                        {periodCount} {periodCount === 1 ? "period" : "periods"}
                      </p>
                    </div>

                    <div
                      style={{ position: "relative", zIndex: 5 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        style={styles.templateMoreButton}
                        onClick={() =>
                          setMenuOpenId((cur) => (cur === template.id ? null : template.id))
                        }
                      >
                        <MoreIcon width={16} height={16} />
                      </button>

                      {menuOpenId === template.id && (
                        <div
                          style={{
                            position: "absolute",
                            right: 0,
                            top: "calc(100% + 8px)",
                            width: "180px",
                            padding: "7px",
                            border: `1px solid ${colors.border}`,
                            borderRadius: "14px",
                            background: colors.card,
                            boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
                            zIndex: 20,
                          }}
                        >
                          <button
                            type="button"
                            style={{
                              width: "100%",
                              border: "none",
                              background: "transparent",
                              color: colors.text,
                              padding: "11px 12px",
                              borderRadius: "9px",
                              textAlign: "left",
                              fontSize: "14px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                            onClick={() => openTemplateBuilder(template.id)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            style={{
                              width: "100%",
                              border: "none",
                              background: "transparent",
                              color: colors.text,
                              padding: "11px 12px",
                              borderRadius: "9px",
                              textAlign: "left",
                              fontSize: "14px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                            onClick={() => renameTemplate(template)}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            style={{
                              width: "100%",
                              border: "none",
                              background: "transparent",
                              color: colors.text,
                              padding: "11px 12px",
                              borderRadius: "9px",
                              textAlign: "left",
                              fontSize: "14px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                            onClick={() => duplicateTemplate(template)}
                          >
                            Duplicate
                          </button>
                          <button
                            type="button"
                            style={{
                              width: "100%",
                              border: "none",
                              background: "transparent",
                              color: colors.danger,
                              padding: "11px 12px",
                              borderRadius: "9px",
                              textAlign: "left",
                              fontSize: "14px",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                            onClick={() => deleteTemplate(template)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* TASK FORM — still only creates/edits planner_tasks rows.
            Calendar/TemplateBuilder remain the way to add periods. */}
        <section style={styles.timerCard}>
          <p style={styles.cardLabel}>{isEditing ? "EDIT TASK" : "ADD A TASK"}</p>

          <form onSubmit={handleSubmit}>
            <input
              style={styles.input}
              type="text"
              placeholder="Task title"
              value={plannerTitle}
              onChange={(e) => setPlannerTitle(e.target.value)}
              disabled={plannerLoading}
            />

            <input
              style={styles.input}
              type="text"
              placeholder="Subject"
              value={plannerSubject}
              onChange={(e) => setPlannerSubject(e.target.value)}
              disabled={plannerLoading}
            />

            <input
              style={styles.input}
              type="date"
              value={plannerDate}
              onChange={(e) => setPlannerDate(e.target.value)}
              disabled={plannerLoading}
            />

            <div style={styles.plannerTwoColumn}>
              <input
                style={styles.input}
                type="time"
                value={plannerStartTime}
                onChange={(e) => setPlannerStartTime(e.target.value)}
                disabled={plannerLoading}
              />
              <input
                style={styles.input}
                type="time"
                value={plannerEndTime}
                onChange={(e) => setPlannerEndTime(e.target.value)}
                disabled={plannerLoading}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <AlarmSelector
                allAlarms={allAlarms}
                value={plannerAlarmId}
                onChange={setPlannerAlarmId}
                onPreview={playAlarm}
                styles={styles}
                label="ALARM WHEN THIS ENDS"
              />
            </div>

            {setPlannerColor && (
              <div style={{ marginBottom: "16px" }}>
                <ColorSelector
                  value={plannerColor}
                  onChange={setPlannerColor}
                  disabled={plannerLoading}
                  styles={styles}
                  label="TASK COLOR"
                />
              </div>
            )}

            <button style={styles.primary} type="submit" disabled={plannerLoading}>
              {plannerLoading ? "Saving..." : isEditing ? "Update Task" : "Add Task"}
            </button>

            {isEditing && (
              <button
                type="button"
                style={styles.secondary}
                onClick={clearPlannerForm}
                disabled={plannerLoading}
              >
                Cancel Edit
              </button>
            )}
          </form>

          {plannerMessage && <p style={styles.message}>{plannerMessage}</p>}
        </section>

        {/* YOUR PLAN — merged list: planner tasks + Calendar/one-off periods +
            timetable periods, grouped by date, all editable/deletable from
            right here regardless of which screen created them. */}
        <section style={{ marginTop: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
              flexWrap: "wrap",
              gap: "8px",
            }}
          >
            <p style={{ ...styles.cardLabel, margin: 0 }}>YOUR PLAN</p>
          </div>

          {/* TODAY / UPCOMING / ALL FILTER */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "16px",
              overflowX: "auto",
              paddingBottom: "2px",
            }}
          >
            {FILTERS.map((f) => {
              const active = planFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setPlanFilter(f.key)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "12px",
                    border: active ? `1px solid ${colors.accent}` : `1px solid ${colors.border}`,
                    background: active ? colors.accentDim : colors.card,
                    color: active ? colors.accent : colors.textDim,
                    fontSize: "12px",
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {plannerItemsMessage && (
            <p style={{ ...styles.message, color: colors.danger }}>{plannerItemsMessage}</p>
          )}

          {plannerItemsLoading ? (
            <div style={styles.timerInfoCard}>
              <p style={styles.cardText}>Loading your plan...</p>
            </div>
          ) : sortedDates.length === 0 ? (
            <div style={styles.timerInfoCard}>
              <p style={styles.cardText}>
                {planFilter === "today"
                  ? "Nothing scheduled for today."
                  : planFilter === "upcoming"
                  ? "Nothing scheduled from today onward."
                  : "Nothing scheduled yet."}
              </p>
              <p style={styles.tipText}>Add a task above, or assign a timetable via Calendar / Weekly Schedule.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {sortedDates.map((dateString) => {
                const items = grouped[dateString];

                return (
                  <div key={dateString}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                        paddingBottom: "6px",
                        borderBottom: `1px solid ${colors.border}`,
                      }}
                    >
                      <strong style={{ fontSize: "14px", color: colors.text }}>
                        {groupHeaderLabel(dateString)}
                      </strong>
                      <span style={{ fontSize: "11px", color: colors.textDim }}>
                        {items.length} item{items.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {items.map((item) => {
                        const isPlanner = item.source === "planner";
                        const isCompleted = Boolean(item.completed);
                        // Color-coded left border: custom color if set on
                        // this item (via TemplateBuilder, Calendar, or a
                        // planner task's own color), otherwise the existing
                        // default (amber for breaks, teal for study) — same
                        // fallback pattern used in Routine.tsx/TemplateBuilder.
                        const accentColor = item.color || (item.isBreak ? colors.warning : colors.accent);

                        return (
                          <div
                            key={item.id}
                            style={{
                              padding: "13px 14px",
                              borderRadius: "14px",
                              background: colors.card,
                              border: `1px solid ${colors.border}`,
                              borderLeft: `4px solid ${accentColor}`,
                              opacity: isCompleted ? 0.65 : 1,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <button
                                type="button"
                                disabled={!isPlanner}
                                onClick={() => isPlanner && handleToggleItemComplete(item)}
                                style={{
                                  width: "30px",
                                  height: "30px",
                                  borderRadius: "10px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                  border: "none",
                                  cursor: isPlanner ? "pointer" : "default",
                                  background: isCompleted ? colors.accentDim : colors.cardAlt,
                                  color: colors.accent,
                                }}
                                aria-label={isPlanner ? "Toggle complete" : undefined}
                              >
                                {isCompleted ? (
                                  <CheckIcon width={13} height={13} />
                                ) : item.isBreak ? (
                                  <CoffeeIcon width={13} height={13} />
                                ) : (
                                  <ClockIcon width={13} height={13} />
                                )}
                              </button>

                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p
                                  style={{
                                    margin: "0 0 3px",
                                    fontWeight: 800,
                                    fontSize: "14px",
                                    color: colors.text,
                                    textDecoration: isCompleted ? "line-through" : "none",
                                  }}
                                >
                                  {item.title}
                                  <span
                                    style={{
                                      marginLeft: "8px",
                                      fontSize: "9px",
                                      fontWeight: 800,
                                      color: colors.textDim,
                                      letterSpacing: "0.5px",
                                      textTransform: "uppercase",
                                    }}
                                  >
                                    {sourceTag(item.source)}
                                  </span>
                                </p>
                                <p style={{ margin: 0, color: colors.textDim, fontSize: "12px" }}>
                                  {item.subject} · {formatTime(item.time)} – {formatTime(item.end)}
                                </p>
                              </div>

                              {item.rating != null && (
                                <span style={{ color: colors.accent, fontSize: "12px", fontWeight: 800, flexShrink: 0 }}>
                                  {item.rating}/10
                                </span>
                              )}
                            </div>

                            <div style={{ display: "flex", gap: "8px", marginTop: "9px" }}>
                              {isPlanner && isCompleted && item.rating == null && (
                                <button
                                  type="button"
                                  onClick={() => setRatingTargetItem(item)}
                                  style={{
                                    padding: "6px 12px",
                                    borderRadius: "8px",
                                    border: `1px solid ${colors.accent}`,
                                    background: colors.accentDim,
                                    color: colors.accent,
                                    fontSize: "11px",
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  Rate this
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => openItemEdit(item)}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  border: `1px solid ${colors.border}`,
                                  background: "transparent",
                                  color: colors.text,
                                  fontSize: "11px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item)}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "8px",
                                  border: `1px solid ${colors.border}`,
                                  background: "transparent",
                                  color: colors.danger,
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                }}
                                aria-label="Delete item"
                              >
                                <TrashIcon width={13} height={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* EDIT MODAL — works for planner task, one-off period, or template
          period, whichever this item actually is */}
      {editingItem && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(4, 7, 8, 0.75)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 400,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "480px",
              background: colors.card,
              borderTop: `1px solid ${colors.border}`,
              borderTopLeftRadius: "26px",
              borderTopRightRadius: "26px",
              padding: "26px 20px calc(30px + env(safe-area-inset-bottom))",
              boxSizing: "border-box",
              maxHeight: "88vh",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "20px", color: colors.text }}>Edit Item</h2>
              <button
                type="button"
                onClick={closeItemEdit}
                style={{ background: "transparent", border: "none", color: colors.textDim, cursor: "pointer" }}
                aria-label="Close"
              >
                <XIcon width={20} height={20} />
              </button>
            </div>

            {editingItem.source === "template" && (
              <p
                style={{
                  fontSize: "12px",
                  color: colors.warning,
                  background: "rgba(232, 196, 104, 0.12)",
                  border: "1px solid rgba(232, 196, 104, 0.3)",
                  borderRadius: "10px",
                  padding: "10px 12px",
                  margin: "0 0 14px",
                }}
              >
                This comes from a saved timetable template. Editing it changes the template itself,
                so every day it's assigned to will also change.
              </p>
            )}

            <label style={{ ...styles.label, color: colors.textDim }}>Title</label>
            <input
              type="text"
              style={{ ...styles.input, background: colors.cardAlt, border: `1px solid ${colors.border}`, color: colors.text }}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />

            <label style={{ ...styles.label, color: colors.textDim }}>Subject</label>
            <input
              type="text"
              style={{ ...styles.input, background: colors.cardAlt, border: `1px solid ${colors.border}`, color: colors.text }}
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
            />

            <div style={styles.plannerTwoColumn}>
              <div>
                <label style={{ ...styles.label, color: colors.textDim }}>Start Time</label>
                <input
                  type="time"
                  style={{ ...styles.input, background: colors.cardAlt, border: `1px solid ${colors.border}`, color: colors.text }}
                  value={editStart}
                  onChange={(e) => setEditStart(e.target.value)}
                />
              </div>
              <div>
                <label style={{ ...styles.label, color: colors.textDim }}>End Time</label>
                <input
                  type="time"
                  style={{ ...styles.input, background: colors.cardAlt, border: `1px solid ${colors.border}`, color: colors.text }}
                  value={editEnd}
                  onChange={(e) => setEditEnd(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <AlarmSelector
                allAlarms={allAlarms}
                value={editAlarmId}
                onChange={setEditAlarmId}
                onPreview={playAlarm}
                styles={styles}
                label="ALARM FOR THIS SESSION"
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <ColorSelector
                value={editColor}
                onChange={setEditColor}
                disabled={editSaving}
                styles={styles}
                label="COLOR"
              />
            </div>

            {editError && (
              <p style={{ color: colors.danger, fontSize: "13px", fontWeight: 700, margin: "0 0 12px" }}>
                {editError}
              </p>
            )}

            <button
              type="button"
              onClick={handleSaveItemEdit}
              disabled={editSaving}
              style={{
                ...styles.primary,
                background: colors.accent,
                color: colors.accentText,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
            >
              <SaveIcon width={16} height={16} />
              {editSaving ? "Saving..." : "Save Changes"}
            </button>

            <button
              type="button"
              onClick={closeItemEdit}
              disabled={editSaving}
              style={{ ...styles.secondary, marginTop: "10px", background: colors.cardAlt, color: colors.textDim, border: `1px solid ${colors.border}` }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* RATING MODAL — planner-sourced items only */}
      {ratingTargetItem && (
        <RatingModal
          title="How was your focus?"
          subtitle={ratingTargetItem.title}
          onSubmit={handleRatingSubmit}
          onSkip={() => setRatingTargetItem(null)}
          styles={styles}
        />
      )}
    </div>
  );
}
