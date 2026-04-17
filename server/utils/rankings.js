const db = require("./db");

/**
 * Recalculates user badges based on verified reports.
 * This is called after every report or vote update.
 */
async function recalculateRankings(io) {
  try {
    // 1. Reset badges only for users who HAVE a badge (Prevents "UPDATE without WHERE" error)
    await db.query("UPDATE users SET badge = NULL WHERE badge IS NOT NULL");

    // 2. Assign 'Gold' badge (Top 3 by verified count)
    await db.query(`
      UPDATE users SET badge = 'Gold' 
      WHERE id IN (
        SELECT id FROM users 
        WHERE verified_count > 0 
        ORDER BY verified_count DESC, total_upvotes DESC 
        LIMIT 3
      )
    `);

    // 3. Assign 'Silver' badge (Next 7)
    await db.query(`
      UPDATE users SET badge = 'Silver' 
      WHERE badge IS NULL AND id IN (
        SELECT id FROM users 
        WHERE verified_count > 0 
        ORDER BY verified_count DESC, total_upvotes DESC 
        OFFSET 3 LIMIT 7
      )
    `);

    // 4. Assign 'Bronze' (Anyone with 5+ verified reports)
    await db.query(`
      UPDATE users SET badge = 'Bronze' 
      WHERE badge IS NULL AND verified_count >= 5
    `);

    if (io) io.emit("rankings_updated");

  } catch (err) {
    console.error("[Rankings Error]", err.message);
  }
}

module.exports = { recalculateRankings };
