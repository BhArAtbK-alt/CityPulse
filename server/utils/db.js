// server/utils/db.js - IMPROVED HYBRID HTTP BRIDGE
const supabase = require("./supabase");

/**
 * IMPROVED HYBRID DB WRAPPER
 * This handles both SELECT and modifying (INSERT/UPDATE) queries.
 */

const query = async (text, params = []) => {
  try {
    let finalSql = text;

    // 1. Convert '?' to '$1' if using SQLite-style placeholders
    if (!/\$\d+/.test(finalSql)) {
      let count = 0;
      finalSql = finalSql.replace(/\?/g, () => `$${++count}`);
    }

    // 2. Safely replace $1, $2 with escaped values
    // We sort parameters in reverse (e.g., $10 before $1) to prevent partial replacement
    const sortedParams = params
      .map((val, idx) => ({ idx: idx + 1, val }))
      .sort((a, b) => b.idx - a.idx);

    sortedParams.forEach(({ idx, val }) => {
      const placeholder = `$${idx}`;
      let escapedVal;

      if (val === null) {
        escapedVal = 'NULL';
      } else if (typeof val === 'boolean') {
        escapedVal = val ? 'TRUE' : 'FALSE';
      } else if (typeof val === 'number') {
        escapedVal = val;
      } else {
        // String escaping for Postgres
        escapedVal = `'${String(val).replace(/'/g, "''")}'`;
      }

      // Use a global replace for the specific placeholder
      finalSql = finalSql.split(placeholder).join(escapedVal);
    });

    // 3. Call the Supabase RPC bridge
    const { data, error } = await supabase.rpc('exec_sql', {
      query_text: finalSql
    });

    if (error) {
      console.error("❌ Bridge Query Error:", error.message);
      console.error("   Query was:", finalSql);
      throw error;
    }

    return { rows: data || [] };

  } catch (err) {
    console.error("❌ Database Bridge Failure:", err.message);
    throw err; // Re-throw so the calling function (like auth.js) knows it failed
  }
};

// Check connection
async function checkConnection() {
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;
    console.log("✅ Supabase HTTP Bridge active.");
  } catch (err) {
    console.error("❌ Supabase Bridge failed:", err.message);
  }
}

checkConnection();

module.exports = {
  query,
  pool: { 
    on: () => {},
    connect: () => ({ release: () => {} })
  }
};
