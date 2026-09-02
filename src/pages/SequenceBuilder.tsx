import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { AppStyles } from "../hooks/useStyles";
import useAlarms from "../hooks/useAlarms";
import { useSequences, SequenceBlock, NewSequenceBlockInput } from "../hooks/useSequences";
import SequencePeriodFormModal, { SequenceBlockFormValues } from "../components/SequencePeriodFormModal";
import { useDragReorder } from "../hooks/useDragReorder";
import { useTheme } from "../context/ThemeContext";
import { getThemeColors } from "../styles/theme";
import { ClockIcon, CoffeeIcon, PlayIcon, PlusIcon, TrashIcon, DragHandleIcon } from "../components/Icons";

interface SequenceBuilderProps {
  user: any;
  templateId: string | null;
  onBack: () => void;
  startCustomTimer: (params: any) => Promise<any>;
  onStarted: () => void;
  styles: AppStyles;
}

// The exact structural counterpart to TemplateBuilder.tsx — same page
// role (build/edit a saved, reusable schedule), same shared-editing
// philosophy (every add/edit/delete/reorder here goes through the exact
// same useSequences functions that Timer.tsx's "Today's Sequence" inline
// editing uses, so nothing here can ever drift out of sync with what
// Timer.tsx shows). The one structural difference from TemplateBuilder:
// blocks are ordered by drag position (sort_order), not clock time, and
// each block can be Started directly from here too, since Sequence is
// meant to be run "whenever you want," not just from one screen.
export default function SequenceBuilder({
  user,
  templateId,
  onBack,
  startCustomTimer,
  onStarted,
  styles,
}: SequenceBuilderProps) {
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const { allAlarms, playAlarm } = useAlarms(user?.id);

  const {
    blocks,
    loadingBlocks,
    blocksError,
    loadBlocks,
    addBlock,
    updateBlock,
    deleteBlock,
    reorderBlocks,
  } = useSequences();

  const [template, setTemplate] = useState<any>(null);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<SequenceBlock | null>(null);
  const [modalError, setModalError] = useState("");

  useEffect(() => {
    async function loadTemplateMeta() {
      if (!templateId) {
        setTemplateLoading(false);
        return;
      }
      setTemplateLoading(true);
      const { data: tmpl, error: tmplError } = await supabase
        .from("sequence_templates")
        .select("*")
        .eq("id", templateId)
        .single();

      if (tmplError) {
        console.error("Sequence template load error:", tmplError);
        setMessage(tmplError.message);
      } else {
        setTemplate(tmpl);
      }
      setTemplateLoading(false);
    }
    loadTemplateMeta();
  }, [templateId]);

  useEffect(() => {
    if (templateId) {
      loadBlocks(templateId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  useEffect(() => {
    if (blocksError) setMessage(blocksError);
  }, [blocksError]);

  const { draggingIndex, getHandleProps, getRowStyle } = useDragReorder<SequenceBlock>({
    items: blocks,
    onReorder: async (newItems) => {
      await reorderBlocks(newItems);
    },
  });

  function handleOpenAdd() {
    setEditingBlock(null);
    setModalError("");
    setShowModal(true);
  }

  function handleOpenEdit(b: SequenceBlock) {
    setEditingBlock(b);
    setModalError("");
    setShowModal(true);
  }

  async function handleSaveBlock(values: SequenceBlockFormValues) {
    if (!templateId) return;
    setSaving(true);
    setModalError("");

    const payload: NewSequenceBlockInput = {
      name: values.name,
      category: values.category || null,
      is_break: values.isBreak,
      duration_minutes: Number(values.durationMinutes),
      alarm_id: values.alarmId || null,
      color: values.color || null,
    };

    if (editingBlock) {
      await updateBlock(editingBlock.id, payload);
      setSaving(false);
      if (blocksError) {
        setModalError(blocksError);
        return;
      }
    } else {
      const created = await addBlock(templateId, payload);
      setSaving(false);
      if (!created) {
        setModalError(blocksError || "Could not save this period.");
        return;
      }
    }

    setShowModal(false);
    setEditingBlock(null);
  }

  async function handleDeleteBlock(id: string) {
    await deleteBlock(id);
    if (blocksError) {
      setMessage(blocksError);
    }
  }

  async function handleStartBlock(b: SequenceBlock) {
    await startCustomTimer({
      taskName: b.name,
      durationMinutes: b.duration_minutes,
      alarmId: b.alarm_id,
      color: b.color,
    });
    onStarted();
  }

  const loading = templateLoading || loadingBlocks;

  return (
    <div style={styles.page}>
      <main style={styles.dashboard}>
        <button type="button" style={styles.backButton} onClick={onBack}>
          ← Back to Sequence
        </button>

        <div style={styles.timerHeader}>
          <p style={styles.eyebrow}>SEQUENCE BUILDER</p>
          <h1 style={styles.routineTitle}>{template?.name || "Sequence"}</h1>
          <p style={styles.cardText}>
            Build the ordered list of periods and breaks in this Sequence. Hold the grip on any
            period to drag it into a new position.
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
            <p style={styles.cardText}>Loading Sequence...</p>
          </div>
        ) : blocks.length === 0 ? (
          <div style={styles.timerInfoCard}>
            <p style={styles.cardText}>No periods in this Sequence yet.</p>
            <p style={styles.tipText}>Tap "Add Period" to start building it.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {blocks.map((b, index) => {
              const accentColor = b.color || (b.is_break ? colors.warning : colors.accent);
              const isDragging = draggingIndex === index;
              const handleProps = getHandleProps(index);

              return (
                <div
                  key={b.id}
                  data-drag-row
                  style={{
                    padding: "16px",
                    borderRadius: "16px",
                    background: colors.card,
                    border: `1px solid ${colors.border}`,
                    borderLeft: `4px solid ${accentColor}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    opacity: isDragging ? 0.92 : 1,
                    ...getRowStyle(index),
                  }}
                >
                  <div
                    {...handleProps}
                    style={{ ...handleProps.style, color: colors.textDim, flexShrink: 0, display: "flex" }}
                    aria-label="Drag to reorder"
                  >
                    <DragHandleIcon width={18} height={18} />
                  </div>

                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "12px",
                      background: b.is_break ? "rgba(232, 196, 104, 0.15)" : colors.accentDim,
                      color: b.is_break ? colors.warning : colors.accent,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {b.is_break ? <CoffeeIcon width={16} height={16} /> : <ClockIcon width={16} height={16} />}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ margin: "0 0 3px", fontWeight: 800, fontSize: "15px", color: colors.text }}>
                      {b.name}
                    </p>
                    <p style={{ margin: 0, fontSize: "12px", color: colors.textDim }}>
                      {b.category ? `${b.category} · ` : ""}
                      {b.duration_minutes} min {b.is_break ? "· Break" : "· Study Period"}
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                    <button
                      type="button"
                      style={{
                        padding: "8px 10px",
                        borderRadius: "10px",
                        border: "none",
                        background: b.is_break ? colors.warning : colors.accent,
                        color: colors.accentText,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                      onClick={() => handleStartBlock(b)}
                      aria-label="Start this period"
                    >
                      <PlayIcon width={14} height={14} />
                    </button>

                    <button
                      type="button"
                      style={{
                        padding: "8px 12px",
                        borderRadius: "10px",
                        border: `1px solid ${colors.border}`,
                        background: "transparent",
                        color: colors.text,
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                      onClick={() => handleOpenEdit(b)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      style={{
                        padding: "8px",
                        borderRadius: "10px",
                        border: `1px solid ${colors.border}`,
                        background: "transparent",
                        color: colors.danger,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onClick={() => handleDeleteBlock(b.id)}
                      aria-label="Delete period"
                    >
                      <TrashIcon width={14} height={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <SequencePeriodFormModal
          open={showModal}
          title={editingBlock ? "Edit Period" : "Add Period"}
          initialValues={
            editingBlock
              ? {
                  name: editingBlock.name,
                  category: editingBlock.category || "",
                  isBreak: editingBlock.is_break,
                  durationMinutes: String(editingBlock.duration_minutes),
                  alarmId: editingBlock.alarm_id,
                  color: editingBlock.color,
                }
              : undefined
          }
          allAlarms={allAlarms}
          onPreviewAlarm={playAlarm}
          onSave={handleSaveBlock}
          onCancel={() => {
            setShowModal(false);
            setEditingBlock(null);
            setModalError("");
          }}
          saving={saving}
          errorMessage={modalError}
          styles={styles}
        />
      </main>
    </div>
  );
}
