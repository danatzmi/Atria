"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildStorageKey, PROJECT_FILES_BUCKET } from "@/lib/supabase/storage";

export type ProjectActionState = { error: string | null };

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
