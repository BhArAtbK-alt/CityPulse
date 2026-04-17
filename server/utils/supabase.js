// server/utils/supabase.js
const { createClient } = require("@supabase/supabase-js");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error("\n❌ MISSING SUPABASE CREDENTIALS");
  console.error("   SUPABASE_URL:", url ? "✅ set" : "❌ MISSING");
  console.error("   SUPABASE_SERVICE_KEY:", key ? "✅ set" : "❌ MISSING");
  console.error("   → Add them to server/.env and restart\n");
  process.exit(1);
}

if (!key.startsWith("eyJ")) {
  console.error("\n❌ SUPABASE_SERVICE_KEY looks wrong (should start with eyJ...)");
  console.error("   Make sure you are using the service_role key, NOT the anon key\n");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: {
    // This empty global object ensures we use the standard runtime fetch
    // which is now forced to IPv4 by our index.js setting.
  }
});

console.log("✅ Supabase connected:", url);

module.exports = supabase;
