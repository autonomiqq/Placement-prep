import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://yadcbqmqpcvxjlokjndl.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhZGNicW1xcGN2eGpsb2tqbmRsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ5OTczOCwiZXhwIjoyMDkwMDc1NzM4fQ.nXoNkKnLEfUsqtB37n6_aEMKUt8FA7UHjCOafbw04yw";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  // 1. Delete all existing users
  console.log("Fetching existing users...");
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) { console.error("List error:", listErr.message); process.exit(1); }

  console.log(`Deleting ${users.length} users...`);
  for (const u of users) {
    // Clear created_by on tests first
    await supabase.from("tests").update({ created_by: null }).eq("created_by", u.id);
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) console.warn(`  Could not delete ${u.email}: ${error.message}`);
    else console.log(`  Deleted: ${u.email}`);
  }

  // 2. Create student account
  // Pass role:"admin" in metadata so the trigger skips the user_category_stats insert (which fails).
  // We fix role and insert stats manually after.
  console.log("\nCreating student account...");
  const { data: studentData, error: studentErr } = await supabase.auth.admin.createUser({
    email: "student@placementprep.com",
    password: "Student@2026",
    email_confirm: true,
    user_metadata: {
      full_name: "Test Student",
      username: "test_student",
      college: "NIT Trichy",
      branch: "CSE",
      role: "admin", // trick: avoids the broken stats insert in trigger
    },
  });
  if (studentErr) {
    console.error("Student create error:", studentErr.message);
  } else {
    console.log("  Student created:", studentData.user.id);
    // Fix role back to student
    await supabase.from("profiles")
      .update({ role: "student", college: "NIT Trichy", branch: "CSE" })
      .eq("id", studentData.user.id);
    // Manually insert category stats
    const categories = ["aptitude", "verbal", "technical", "coding"];
    for (const cat of categories) {
      await supabase.from("user_category_stats")
        .upsert({ user_id: studentData.user.id, category: cat }, { onConflict: "user_id,category" });
    }
    console.log("  Role set to student, category stats inserted.");
  }

  // 3. Create admin account
  console.log("\nCreating admin account...");
  const { data: adminData, error: adminErr } = await supabase.auth.admin.createUser({
    email: "admin@placementprep.com",
    password: "Admin@2026",
    email_confirm: true,
    user_metadata: {
      full_name: "Admin",
      username: "admin",
      role: "admin",
    },
  });
  if (adminErr) { console.error("Admin create error:", adminErr.message); }
  else {
    console.log("  Admin created:", adminData.user.id);
    // Promote to admin role
    const { error: roleErr } = await supabase
      .from("profiles")
      .update({ role: "admin" })
      .eq("id", adminData.user.id);
    if (roleErr) console.warn("  Role update error:", roleErr.message);
    else console.log("  Role set to admin.");
  }

  console.log("\nDone!");
  console.log("Student: student@placementprep.com / Student@2026");
  console.log("Admin:   admin@placementprep.com  / Admin@2026");
}

run().catch(console.error);
