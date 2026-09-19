import { redirect } from "next/navigation";

// /settings itself has no content — Profile is the natural landing section,
// and a redirect keeps old links and bookmarks working.
export default function SettingsIndex() {
  redirect("/settings/profile");
}
