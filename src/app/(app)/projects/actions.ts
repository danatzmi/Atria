"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  exceedsProjectLimit,
  planFor,
  projectLimitMessage,
  storageLimitMessage,
} from "@/lib/plans";
import { buildStorageKey, PROJECT_FILES_BUCKET } from "@/lib/supabase/storage";

export type ProjectActionState = {
  error: string | null;
  // Set when the failure is a plan ceiling rather than a mistake the user
  // can correct. Lets the dialog offer an upgrade instead of scolding, and
  // is a typed flag rather than the UI string-matching the message.
  atPlanLimit?: boolean;
};

const MAX_COVER_IMAGE_BYTES = 8 * 1024 * 1024;

function isImageFile(file: File): boolean {
  return file.size > 0 && file.type.startsWith("image/");
}

function validateCoverImage(file: File): string | null {
  if (!isImageFile(file)) return "Cover image must be an image file.";
  if (file.size > MAX_COVER_IMAGE_BYTES) return "Cover image must be under 8MB.";
  return null;
}

async function uploadCoverImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  projectId: string,
  file: File
): Promise<string> {
  const storageKey = buildStorageKey(userId, projectId, "cover", file.name);
  const { error } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .upload(storageKey, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return storageKey;
}

export async function createProject(
  _prevState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const coverImage = formData.get("cover_image");
  const hasCoverImage = coverImage instanceof File && coverImage.size > 0;

  if (!name) {
    return { error: "Give your project a name." };
  }

  if (hasCoverImage) {
    const validationError = validateCoverImage(coverImage as File);
    if (validationError) return { error: validationError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to sign in again." };
  }

  // Plan limit, checked server-side. The dialog also surfaces this, but
  // the action is the only place that can actually be trusted — the client
  // can call it directly.
  //
  // `plan` is read with the user's own client, so RLS confines it to their
  // row; a missing row falls back to Free (planFor's default), which is the
  // restrictive direction to fail in.
  const [{ data: profile }, { count: projectCount }] = await Promise.all([
    supabase.from("users").select("plan").eq("id", user.id).maybeSingle(),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const plan = planFor(profile?.plan);
  if (exceedsProjectLimit(plan, projectCount ?? 0)) {
    return { error: projectLimitMessage(plan), atPlanLimit: true };
  }

  const { data: project, error: insertError } = await supabase
    .from("projects")
    .insert({ name, description: description || null })
    .select()
    .single();

  if (insertError || !project) {
    return { error: "Couldn't create the project. Please try again." };
  }

  if (hasCoverImage) {
    try {
      const storageKey = await uploadCoverImage(
        supabase,
        user.id,
        project.id,
        coverImage as File
      );
      const { error: coverUpdateError } = await supabase
        .from("projects")
        .update({ cover_image: storageKey })
        .eq("id", project.id);
      // The project row never ended up pointing at this object — clean it
      // up rather than leaving it as unreferenced storage bloat.
      if (coverUpdateError) {
        await supabase.storage.from(PROJECT_FILES_BUCKET).remove([storageKey]);
      }
    } catch {
      // The project itself was created successfully — the cover image can
      // be added afterwards from the project page, so this isn't fatal.
    }
  }

  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function renameProject(
  _prevState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const projectId = String(formData.get("project_id") ?? "");

  // Partial update: only the fields the submitting form actually rendered
  // get written. The top header's dialog edits just the title, the Project
  // Overview canvas's edits just the description, and the dashboard card's
  // edits both — so an ABSENT field means "leave it as it is", never
  // "clear it". (A present-but-empty description still clears it, which is
  // how the overview dialog removes an overview.)
  const updates: { name?: string; description?: string | null } = {};

  if (formData.has("name")) {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      return { error: "Give your project a name." };
    }
    updates.name = name;
  }

  if (formData.has("description")) {
    updates.description = String(formData.get("description") ?? "").trim() || null;
  }

  if (Object.keys(updates).length === 0) {
    return { error: null };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update(updates)
    .eq("id", projectId);

  if (error) {
    return { error: "Couldn't save your changes. Please try again." };
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}

export async function updateCoverImage(
  _prevState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const projectId = String(formData.get("project_id") ?? "");
  const coverImage = formData.get("cover_image");

  if (!(coverImage instanceof File) || coverImage.size === 0) {
    return { error: "Choose an image to upload." };
  }

  const validationError = validateCoverImage(coverImage);
  if (validationError) return { error: validationError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to sign in again." };
  }

  const { data: existingProject } = await supabase
    .from("projects")
    .select("cover_image")
    .eq("id", projectId)
    .single();

  let storageKey: string;
  try {
    storageKey = await uploadCoverImage(supabase, user.id, projectId, coverImage);
  } catch {
    return { error: "Couldn't upload the cover image. Please try again." };
  }

  const { error: updateError } = await supabase
    .from("projects")
    .update({ cover_image: storageKey })
    .eq("id", projectId);

  if (updateError) {
    // The project row never ended up pointing at this object — clean it up
    // rather than leaving it as unreferenced storage bloat.
    await supabase.storage.from(PROJECT_FILES_BUCKET).remove([storageKey]);
    return { error: "Couldn't update the cover image. Please try again." };
  }

  if (existingProject?.cover_image && existingProject.cover_image !== storageKey) {
    await supabase.storage
      .from(PROJECT_FILES_BUCKET)
      .remove([existingProject.cover_image]);
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}

export async function deleteProject(
  _prevState: ProjectActionState,
  formData: FormData
): Promise<ProjectActionState> {
  const projectId = String(formData.get("project_id") ?? "");

  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("cover_image")
    .eq("id", projectId)
    .single();

  // Every file's storage object must be purged too — the DB row cascade
  // (folders/files) doesn't touch Storage, which is a separate system.
  const { data: files } = await supabase
    .from("files")
    .select("storage_key, thumbnail_key")
    .eq("project_id", projectId);

  const { error } = await supabase.from("projects").delete().eq("id", projectId);

  if (error) {
    return { error: "Couldn't delete the project. Please try again." };
  }

  const keys = (files ?? []).flatMap((f) =>
    [f.storage_key, f.thumbnail_key].filter((k): k is string => !!k)
  );
  if (project?.cover_image) keys.push(project.cover_image);
  if (keys.length > 0) {
    await supabase.storage.from(PROJECT_FILES_BUCKET).remove(keys);
  }

  revalidatePath("/projects");
  redirect("/projects");
}

// ---------------------------------------------------------------------------
// Duplicate a project
// ---------------------------------------------------------------------------

export type DuplicateMode = "full" | "template";

// How many storage objects are copied per round of requests. Copies are
// issued in parallel within a chunk and chunks run in sequence: one at a
// time is too slow for a binder with hundreds of files, all at once trips
// Storage's rate limiting and fails a copy halfway through for no reason
// the user could act on.
const COPY_CHUNK_SIZE = 50;

export async function duplicateProject(
  projectId: string,
  mode: DuplicateMode
): Promise<ProjectActionState & { newProjectId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to sign in again." };

  // Read the source through the user's own client: RLS is what confirms
  // this project is theirs, so there is no ownership check to write.
  const { data: source } = await supabase
    .from("projects")
    .select("id, name, cover_image")
    .eq("id", projectId)
    .maybeSingle();

  if (!source) return { error: "That project no longer exists." };

  const [{ data: profile }, { count: projectCount }, { data: sourceFiles }] =
    await Promise.all([
      supabase.from("users").select("plan").eq("id", user.id).maybeSingle(),
      supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("files")
        .select("id, name, storage_key, size_bytes")
        .eq("project_id", projectId),
    ]);

  const plan = planFor(profile?.plan);

  // Both ceilings are checked before a single byte is copied. Copying first
  // and checking after would leave the objects in the bucket counting
  // against a limit the user was just told they had exceeded.
  if (exceedsProjectLimit(plan, projectCount ?? 0)) {
    return { error: projectLimitMessage(plan), atPlanLimit: true };
  }

  const files = sourceFiles ?? [];
  const isFullCopy = mode === "full";

  if (isFullCopy) {
    const incoming = files.reduce((total, f) => total + (f.size_bytes ?? 0), 0);

    // Usage across every project the user owns, not just this one — RLS
    // already scopes `files` to their own rows, so no user filter is
    // needed and none can be forgotten. Cover images are not rows in
    // `files` and carry no recorded size, so they are excluded; the count
    // is therefore a slight under-estimate of true bucket usage.
    const { data: allFiles } = await supabase.from("files").select("size_bytes");
    const used = (allFiles ?? []).reduce((total, f) => total + (f.size_bytes ?? 0), 0);

    if (used + incoming > plan.storageBytes) {
      return { error: storageLimitMessage(plan, "duplicate this project"), atPlanLimit: true };
    }
  }

  // Ids are minted here rather than in the database because files.storage_key
  // is UNIQUE and the key embeds both the project id and the file id — the
  // objects have to be copied to their final keys before any row can point
  // at them. See the migration's header for the full reasoning.
  const newProjectId = crypto.randomUUID();

  const fileMap = isFullCopy
    ? files.map((f) => {
        const newId = crypto.randomUUID();
        return {
          old_id: f.id,
          new_id: newId,
          storage_key: buildStorageKey(user.id, newProjectId, newId, f.name),
          source_key: f.storage_key,
        };
      })
    : [];

  // Objects first, rows second. If a copy fails we have created nothing in
  // the database and there is nothing to unwind beyond the objects listed
  // right here. The other order leaves a project whose files 404 — visible
  // to the user, and much harder to detect afterwards.
  const copied: string[] = [];

  async function removeCopiedObjects() {
    if (copied.length === 0) return;
    for (let i = 0; i < copied.length; i += COPY_CHUNK_SIZE) {
      await supabase.storage
        .from(PROJECT_FILES_BUCKET)
        .remove(copied.slice(i, i + COPY_CHUNK_SIZE));
    }
  }

  let newCoverImage: string | null = null;

  // A template copy starts coverless on purpose: it is meant as a blank
  // slate for the next client, and the previous one's photo is the least
  // appropriate thing to carry over. It is also what keeps a template copy
  // a zero-storage operation.
  if (isFullCopy && source.cover_image) {
    const coverKey = buildStorageKey(user.id, newProjectId, "cover", "cover");
    const { error } = await supabase.storage
      .from(PROJECT_FILES_BUCKET)
      .copy(source.cover_image, coverKey);
    if (!error) {
      newCoverImage = coverKey;
      copied.push(coverKey);
    }
    // A missing cover is cosmetic — not worth failing a duplicate over, so
    // this deliberately does not return.
  }

  for (let i = 0; i < fileMap.length; i += COPY_CHUNK_SIZE) {
    const chunk = fileMap.slice(i, i + COPY_CHUNK_SIZE);
    const results = await Promise.all(
      chunk.map((f) =>
        supabase.storage
          .from(PROJECT_FILES_BUCKET)
          .copy(f.source_key, f.storage_key)
          .then(({ error }) => ({ key: f.storage_key, error }))
      )
    );

    const failed = results.find((r) => r.error);
    for (const r of results) {
      if (!r.error) copied.push(r.key);
    }

    if (failed) {
      console.error("[atria] duplicateProject copy failed:", failed.error?.message);
      await removeCopiedObjects();
      return {
        error: "Couldn't copy this project's files. Nothing was created — please try again.",
      };
    }
  }

  const { error: rpcError } = await supabase.rpc("duplicate_project_hierarchy", {
    p_source_project_id: projectId,
    p_new_project_id: newProjectId,
    p_new_name: `${source.name} (copy)`,
    p_new_cover_image: newCoverImage,
    p_include_content: isFullCopy,
    // The database has no use for source_key — it is only how this function
    // remembers what to copy from.
    p_file_map: fileMap.map(({ old_id, new_id, storage_key }) => ({
      old_id,
      new_id,
      storage_key,
    })),
  });

  if (rpcError) {
    console.error("[atria] duplicateProject rpc failed:", rpcError.message);
    await removeCopiedObjects();
    return { error: "Couldn't duplicate the project. Please try again." };
  }

  revalidatePath("/projects");
  return { error: null, newProjectId };
}
