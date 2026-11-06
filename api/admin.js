// /api/admin  (사장님 전용)  헤더 x-admin-password 에 비밀번호가 맞아야 해요.
//   GET    : 전체 예약 목록
//   DELETE : 예약 취소   ?code=예약번호
// 비밀번호는 Vercel 환경변수 ADMIN_PASSWORD 에 넣어 두세요.
const crypto = require("crypto");
const L = require("./_lib");

function passwordOk(given) {
  const real = process.env.ADMIN_PASSWORD || "";
  if (!real) return null; // 아직 설정 안 됨
  const a = crypto.createHash("sha256").update(String(given || "")).digest();
  const b = crypto.createHash("sha256").update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = async function handler(req, res) {
  try {
    const ok = passwordOk(req.headers["x-admin-password"]);
    if (ok === null) return L.send(res, 503, { error: "관리자 비밀번호(ADMIN_PASSWORD)가 아직 설정되지 않았어요." });
    if (!ok) return L.send(res, 401, { error: "비밀번호가 틀렸어요." });

    await L.ensureSchema();
    const sql = L.getSql();

    if (req.method === "GET") {
      const rows = await sql.query(
        `SELECT code, site_id, to_char(check_in,'YYYY-MM-DD') AS check_in,
                to_char(check_out,'YYYY-MM-DD') AS check_out, people, name, phone, total, status, created_at
           FROM reservations ORDER BY check_in DESC, id DESC LIMIT 500`
      );
      return L.send(res, 200, { reservations: rows.map(L.toPublic) });
    }

    if (req.method === "DELETE") {
      const code = String((req.query && req.query.code) || "").trim().toUpperCase();
      if (!code) return L.send(res, 400, { error: "예약번호가 필요해요." });
      const rows = await sql.query(
        `UPDATE reservations SET status = 'cancelled' WHERE code = $1
         RETURNING code, site_id, to_char(check_in,'YYYY-MM-DD') AS check_in,
                   to_char(check_out,'YYYY-MM-DD') AS check_out, people, name, phone, total, status, created_at`,
        [code]
      );
      if (!rows.length) return L.send(res, 404, { error: "그런 예약이 없어요." });
      return L.send(res, 200, { reservation: L.toPublic(rows[0]) });
    }

    L.send(res, 405, { error: "지원하지 않는 요청이에요." });
  } catch (e) { L.handleError(res, e); }
};
