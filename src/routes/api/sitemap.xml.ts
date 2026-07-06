import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env/public";

export async function GET() {
  const { supabaseUrl, supabasePublishableKey } = getSupabasePublicEnv();
  const supabase = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: false,
    },
  });

  const { data: professors } = await supabase.from("professor").select("id");

  const baseUrl = "https://claustrum.maugp.com";

  // Static routes
  const urls = [
    { loc: `${baseUrl}/`, priority: 1.0, changefreq: "weekly" },
    { loc: `${baseUrl}/schedule/`, priority: 0.9, changefreq: "weekly" },
    { loc: `${baseUrl}/curriculum/`, priority: 0.9, changefreq: "weekly" },
    { loc: `${baseUrl}/professors/`, priority: 0.9, changefreq: "weekly" },
    { loc: `${baseUrl}/policies/`, priority: 0.6, changefreq: "monthly" },
  ];

  if (professors) {
    for (const professor of professors) {
      urls.push({
        loc: `${baseUrl}/professors/${professor.id}`,
        priority: 0.8,
        changefreq: "weekly",
      });
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
