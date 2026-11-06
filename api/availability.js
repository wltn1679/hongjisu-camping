// GET /api/availability  → 예약이 찬 날짜 목록 (이름·연락처 같은 개인정보는 절대 포함하지 않아요)
const L = require("./_lib");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return L.send(res, 405, { error: "GET만 가능해요." });
  try {
    await L.ensureSchema();
    const sql = L.getSql();
    const rows = await sql.query(
      `SELECT site_id, to_char(check_in,'YYYY-MM-DD') AS check_in, to_char(check_out,'YYYY-MM-DD') AS check_out
         FROM reservations
        WHERE status = 'confirmed' AND check_out >= $1::date
        ORDER BY check_in`,
      [L.todayKST()]
    );
    L.send(res, 200, {
      bookings: rows.map(function (r) { return { siteId: r.site_id, checkIn: r.check_in, checkOut: r.check_out }; }),
    });
  } catch (e) { L.handleError(res, e); }
};
