import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// RLS already scopes this to the signed-in user's own projects, so a
// missing row here means "doesn't exist" and "belongs to someone else"
// look identical from the outside — which is the correct behavior.
export async function getProjectOrNotFound(id: string) {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, description, cover_image")
    .eq("id", id)
    .single();

  if (!project) notFound();

  return { supabase, project };
}
