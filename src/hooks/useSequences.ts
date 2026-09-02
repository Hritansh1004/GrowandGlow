import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import useAuth from "./useAuth";

export interface SequenceTemplate {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface SequenceBlock {
  id: string;
  template_id: string;
  user_id: string;
  name: string;
  category: string | null;
  is_break: boolean;
  duration_minutes: number;
  alarm_id: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
}

export type NewSequenceBlockInput = {
  name: string;
  category?: string | null;
  is_break: boolean;
  duration_minutes: number;
  alarm_id?: string | null;
  color?: string | null;
};

export function useSequences() {
  const { user } = useAuth();

  const [templates, setTemplates] = useState<SequenceTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const [blocks, setBlocks] = useState<SequenceBlock[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [blocksError, setBlocksError] = useState<string | null>(null);

  const fetchSequenceTemplates = useCallback(async () => {
    if (!user) return;
    setLoadingTemplates(true);
    setTemplatesError(null);
    const { data, error } = await supabase
      .from("sequence_templates")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setTemplatesError(error.message);
    } else {
      setTemplates(data ?? []);
    }
    setLoadingTemplates(false);
  }, [user]);

  useEffect(() => {
    fetchSequenceTemplates();
  }, [fetchSequenceTemplates]);

  const createSequenceTemplate = useCallback(
    async (name: string): Promise<SequenceTemplate | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("sequence_templates")
        .insert({ user_id: user.id, name })
        .select()
        .single();

      if (error) {
        setTemplatesError(error.message);
        return null;
      }
      setTemplates((prev) => [data, ...prev]);
      return data;
    },
    [user]
  );

  const renameSequenceTemplate = useCallback(
    async (templateId: string, newName: string) => {
      const { error } = await supabase
        .from("sequence_templates")
        .update({ name: newName })
        .eq("id", templateId);

      if (error) {
        setTemplatesError(error.message);
        return;
      }
      setTemplates((prev) =>
        prev.map((t) => (t.id === templateId ? { ...t, name: newName } : t))
      );
    },
    []
  );

  const duplicateSequenceTemplate = useCallback(
    async (templateId: string): Promise<SequenceTemplate | null> => {
      if (!user) return null;
      const original = templates.find((t) => t.id === templateId);
      if (!original) return null;

      const { data: newTemplate, error: templateErr } = await supabase
        .from("sequence_templates")
        .insert({ user_id: user.id, name: `${original.name} (Copy)` })
        .select()
        .single();

      if (templateErr || !newTemplate) {
        setTemplatesError(templateErr?.message ?? "Failed to duplicate");
        return null;
      }

      const { data: originalBlocks, error: blocksFetchErr } = await supabase
        .from("sequence_template_blocks")
        .select("*")
        .eq("template_id", templateId)
        .order("sort_order", { ascending: true });

      if (blocksFetchErr) {
        setTemplatesError(blocksFetchErr.message);
        return newTemplate;
      }

      if (originalBlocks && originalBlocks.length > 0) {
        const copies = originalBlocks.map((b) => ({
          template_id: newTemplate.id,
          user_id: user.id,
          name: b.name,
          category: b.category,
          is_break: b.is_break,
          duration_minutes: b.duration_minutes,
          alarm_id: b.alarm_id,
          color: b.color,
          sort_order: b.sort_order,
        }));
        const { error: insertErr } = await supabase
          .from("sequence_template_blocks")
          .insert(copies);
        if (insertErr) {
          setTemplatesError(insertErr.message);
        }
      }

      setTemplates((prev) => [newTemplate, ...prev]);
      return newTemplate;
    },
    [user, templates]
  );

  const deleteSequenceTemplate = useCallback(async (templateId: string) => {
    const { error } = await supabase
      .from("sequence_templates")
      .delete()
      .eq("id", templateId);

    if (error) {
      setTemplatesError(error.message);
      return;
    }
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    if (activeTemplateId === templateId) {
      setActiveTemplateId(null);
      setBlocks([]);
    }
  }, [activeTemplateId]);

  const loadBlocks = useCallback(async (templateId: string) => {
    setActiveTemplateId(templateId);
    setLoadingBlocks(true);
    setBlocksError(null);
    const { data, error } = await supabase
      .from("sequence_template_blocks")
      .select("*")
      .eq("template_id", templateId)
      .order("sort_order", { ascending: true });

    if (error) {
      setBlocksError(error.message);
    } else {
      setBlocks(data ?? []);
    }
    setLoadingBlocks(false);
  }, []);

  const addBlock = useCallback(
    async (templateId: string, input: NewSequenceBlockInput): Promise<SequenceBlock | null> => {
      if (!user) return null;
      const nextSortOrder =
        blocks.length > 0 ? Math.max(...blocks.map((b) => b.sort_order)) + 1 : 0;

      const { data, error } = await supabase
        .from("sequence_template_blocks")
        .insert({
          template_id: templateId,
          user_id: user.id,
          name: input.name,
          category: input.category ?? "General",
          is_break: input.is_break,
          duration_minutes: input.duration_minutes,
          alarm_id: input.alarm_id ?? null,
          color: input.color ?? null,
          sort_order: nextSortOrder,
        })
        .select()
        .single();

      if (error) {
        setBlocksError(error.message);
        return null;
      }
      setBlocks((prev) => [...prev, data]);
      return data;
    },
    [user, blocks]
  );

  const updateBlock = useCallback(
    async (blockId: string, changes: Partial<NewSequenceBlockInput>) => {
      setBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, ...changes } as SequenceBlock : b))
      );
      const { error } = await supabase
        .from("sequence_template_blocks")
        .update(changes)
        .eq("id", blockId);

      if (error) {
        setBlocksError(error.message);
      }
    },
    []
  );

  const deleteBlock = useCallback(async (blockId: string) => {
    const prevBlocks = blocks;
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
    const { error } = await supabase
      .from("sequence_template_blocks")
      .delete()
      .eq("id", blockId);

    if (error) {
      setBlocksError(error.message);
      setBlocks(prevBlocks);
    }
  }, [blocks]);

  const reorderBlocks = useCallback(
    async (newOrder: SequenceBlock[]) => {
      const withNewSortOrder = newOrder.map((b, index) => ({ ...b, sort_order: index }));
      setBlocks(withNewSortOrder);

      // IMPORTANT: this must be a genuine UPDATE per row, not .upsert().
      // upsert() compiles to INSERT ... ON CONFLICT DO UPDATE under the
      // hood, and Postgres still validates that INSERT's WITH CHECK
      // clause against the RLS policy on sequence_template_blocks, which
      // requires user_id to be present and equal to auth.uid(). Since a
      // reorder payload only ever carries {id, sort_order}, that check
      // fails with "new row violates row-level security policy" even
      // though this is logically just reordering the user's own existing
      // rows. Plain .update() only touches the sort_order column and
      // leaves user_id untouched, so the RLS check trivially passes.
      const results = await Promise.all(
        withNewSortOrder.map((b) =>
          supabase
            .from("sequence_template_blocks")
            .update({ sort_order: b.sort_order })
            .eq("id", b.id)
        )
      );

      const firstError = results.find((r) => r.error)?.error;
      if (firstError) {
        setBlocksError(firstError.message);
      }
    },
    []
  );

  return {
    templates,
    loadingTemplates,
    templatesError,
    fetchSequenceTemplates,
    createSequenceTemplate,
    renameSequenceTemplate,
    duplicateSequenceTemplate,
    deleteSequenceTemplate,

    blocks,
    activeTemplateId,
    loadingBlocks,
    blocksError,
    loadBlocks,
    addBlock,
    updateBlock,
    deleteBlock,
    reorderBlocks,
  };
}
