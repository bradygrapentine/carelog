import { z } from "zod";
import { router, protectedProcedure } from "../trpc/index";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "../supabaseAdmin.server";

const listInput = z.object({
  org_id: z.string().uuid(),
  recipient_id: z.string().uuid(),
  q: z.string().trim().min(1).max(200).optional(),
});

const deleteInput = z.object({
  id: z.string().uuid(),
  org_id: z.string().uuid(),
});

export const documentsRouter = router({
  list: protectedProcedure.input(listInput).query(async ({ ctx, input }) => {
    const { data: membership } = await supabaseAdmin
      .from("memberships")
      .select("role")
      .eq("org_id", input.org_id)
      .eq("user_id", ctx.user.id)
      .not("accepted_at", "is", null)
      .single();
    if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

    // Base query — always filter by org + recipient
    let query = supabaseAdmin
      .from("documents")
      .select(
        "id, display_name, doc_type, file_size, uploaded_by, created_at, extracted_text",
      )
      .eq("org_id", input.org_id)
      .eq("recipient_id", input.recipient_id)
      .order("created_at", { ascending: false });

    // When `q` is provided, narrow to rows matching name OR extracted_text FTS
    if (input.q) {
      const q = input.q;
      // PostgREST textSearch targets extracted_text_tsv; display_name uses ilike.
      // We run two queries and union client-side to keep RLS intact (no raw SQL).
      const [nameResult, ftsResult] = await Promise.all([
        query.ilike("display_name", `%${q}%`),
        supabaseAdmin
          .from("documents")
          .select(
            "id, display_name, doc_type, file_size, uploaded_by, created_at, extracted_text",
          )
          .eq("org_id", input.org_id)
          .eq("recipient_id", input.recipient_id)
          .textSearch("extracted_text_tsv", q, { type: "websearch" })
          .order("created_at", { ascending: false }),
      ]);

      if (nameResult.error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: nameResult.error.message,
        });
      if (ftsResult.error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: ftsResult.error.message,
        });

      // Merge, deduplicate by id, mark body-only FTS hits with match_snippet
      const nameIds = new Set((nameResult.data ?? []).map((r) => r.id));
      const ftsIds = new Set((ftsResult.data ?? []).map((r) => r.id));

      type RawDoc = (typeof nameResult.data)[number];
      type DocWithSnippet = RawDoc & { match_snippet: string | null };

      const merged: DocWithSnippet[] = [];
      const seen = new Set<string>();

      for (const row of nameResult.data ?? []) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          merged.push({ ...row, match_snippet: null });
        }
      }
      for (const row of ftsResult.data ?? []) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          // Body-only match — provide a short snippet from extracted_text
          const snippet = nameIds.has(row.id)
            ? null
            : row.extracted_text
              ? row.extracted_text.slice(0, 120) + "…"
              : null;
          merged.push({ ...row, match_snippet: snippet });
        } else if (!nameIds.has(row.id) && ftsIds.has(row.id)) {
          // Already in list via name match but also has body hit — no snippet needed
        }
      }

      // Sort by created_at desc (both sets are already ordered, but merged may not be)
      merged.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      return merged.map(({ extracted_text: _et, ...rest }) => rest);
    }

    const { data, error } = await query;
    if (error)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error.message,
      });
    return (data ?? []).map(({ extracted_text: _et, ...rest }) => ({
      ...rest,
      match_snippet: null as string | null,
    }));
  }),

  delete: protectedProcedure
    .input(deleteInput)
    .mutation(async ({ ctx, input }) => {
      const { data: membership } = await supabaseAdmin
        .from("memberships")
        .select("role")
        .eq("org_id", input.org_id)
        .eq("user_id", ctx.user.id)
        .not("accepted_at", "is", null)
        .single();
      if (!membership || membership.role !== "coordinator") {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const { data: doc, error: fetchError } = await supabaseAdmin
        .from("documents")
        .select("storage_path")
        .eq("id", input.id)
        .eq("org_id", input.org_id)
        .single();
      if (fetchError || !doc) throw new TRPCError({ code: "NOT_FOUND" });

      await supabaseAdmin.storage
        .from("care-documents")
        .remove([doc.storage_path]);

      const { error } = await supabaseAdmin
        .from("documents")
        .delete()
        .eq("id", input.id)
        .eq("org_id", input.org_id);
      if (error)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error.message,
        });
      return { ok: true };
    }),
});
