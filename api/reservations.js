// /api/reservations
//   POST   : 예약하기            body = { siteId, checkIn, checkOut, people, name, phone }
//   GET    : 내 예약 조회         ?code=예약번호&phone=전화번호
//   DELETE : 내 예약 취소         ?code=예약번호&phone=전화번호
const L = require("./_lib");

const SELECT = `SELECT code, site_id, to_char(check_in,'YYYY-MM-DD') AS check_in,
  to_char(check_out,'YYYY-MM-DD') AS check_out, people, name, phone, total, status, created_at
  FROM reservations`;

module.exports = async function handler(req, res) {
  try {
    if (req.method === "POST") return await create(req, res);
    if (req.method === "GET") return await lookup(req, res);
    if (req.method === "DELETE") return await cancel(req, res);
    return L.send(res, 405, { error: "지원하지 않는 요청이에요." });
  } catch (e) { L.handleError(res, e); }
};

async function create(req, res) {
  const body = await L.readBody(req);
  const v = L.validateReservation(body);
  if (v.error) return L.send(res, 400, { error: v.error });

  await L.ensureSchema();
  const sql = L.getSql();

  // 예약번호가 우연히 겹치면 몇 번 다시 시도
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = L.newCode();
    try {
      const rows = await sql.query(
        `INSERT INTO reservations (code, site_id, check_in, check_out, people, name, phone, total)
         VALUES ($1, $2, $3::date, $4::date, $5, $6, $7, $8)
         RETURNING code, site_id, to_char(check_in,'YYYY-MM-DD') AS check_in,
                   to_char(check_out,'YYYY-MM-DD') AS check_out, people, name, phone, total, status, created_at`,
        [code, v.site.id, body.checkIn, body.checkOut, v.people, v.name, v.phone, v.total]
      );
      return L.send(res, 201, { reservation: L.toPublic(rows[0]) });
    } catch (e) {
      if (e && e.code === "23P01") { // 같은 구역·겹치는 날짜 → DB 규칙이 막음
        return L.send(res, 409, { error: "그 날짜에는 이미 예약이 있어요. 다른 날짜를 선택해 주세요." });
      }
      if (e && e.code === "23505") continue; // 예약번호 중복 → 새 번호로 재시도
      throw e;
    }
  }
  return L.send(res, 500, { error: "예약번호를 만들지 못했어요. 다시 시도해 주세요." });
}

async function lookup(req, res) {
  const code = String((req.query && req.query.code) || "").trim().toUpperCase();
  const phone = L.normPhone(req.query && req.query.phone);
  if (!code || !phone) return L.send(res, 400, { error: "예약번호와 전화번호를 입력해 주세요." });
  await L.ensureSchema();
  const rows = await L.getSql().query(SELECT + " WHERE code = $1 AND phone = $2", [code, phone]);
  if (!rows.length) return L.send(res, 404, { error: "일치하는 예약이 없어요. 예약번호와 전화번호를 확인해 주세요." });
  L.send(res, 200, { reservation: L.toPublic(rows[0]) });
}

async function cancel(req, res) {
  const body = await L.readBody(req);
  const code = String((req.query && req.query.code) || body.code || "").trim().toUpperCase();
  const phone = L.normPhone((req.query && req.query.phone) || body.phone);
  if (!code || !phone) return L.send(res, 400, { error: "예약번호와 전화번호를 입력해 주세요." });
  await L.ensureSchema();
  const sql = L.getSql();
  const rows = await sql.query(SELECT + " WHERE code = $1 AND phone = $2", [code, phone]);
  if (!rows.length) return L.send(res, 404, { error: "일치하는 예약이 없어요." });
  const r = rows[0];
  if (r.status !== "confirmed") return L.send(res, 400, { error: "이미 취소된 예약이에요." });
  if (r.check_in <= L.todayKST()) {
    return L.send(res, 400, { error: "입실 당일 이후에는 직접 취소할 수 없어요. 캠핑장으로 연락해 주세요." });
  }
  const upd = await sql.query(
    `UPDATE reservations SET status = 'cancelled' WHERE code = $1 AND phone = $2
     RETURNING code, site_id, to_char(check_in,'YYYY-MM-DD') AS check_in,
               to_char(check_out,'YYYY-MM-DD') AS check_out, people, name, phone, total, status, created_at`,
    [code, phone]
  );
  L.send(res, 200, { reservation: L.toPublic(upd[0]) });
}
