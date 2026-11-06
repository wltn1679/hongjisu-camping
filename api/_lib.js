// ===== 서버 공통 도구 (이 파일은 주소로 열리지 않아요. _ 로 시작하는 파일은 내부용) =====
const crypto = require("crypto");
const { SITES } = require("../data.js");

// ---------- 데이터베이스 ----------
let _sql = null;
function getSql() {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    const e = new Error("DB_NOT_CONFIGURED");
    e.code = "DB_NOT_CONFIGURED";
    throw e;
  }
  const { neon } = require("@neondatabase/serverless");
  _sql = neon(url);
  return _sql;
}

// 테스트에서 가짜 DB를 끼워 넣기 위한 함수
function _setSqlForTest(fake) { _sql = fake; schemaReady = null; }

// 표(테이블)가 없으면 만들기. 같은 날짜가 겹치는 예약은 DB 규칙으로 막아요.
let schemaReady = null;
function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async function () {
    const sql = getSql();
    await sql.query("CREATE EXTENSION IF NOT EXISTS btree_gist");
    await sql.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id          SERIAL PRIMARY KEY,
        code        TEXT UNIQUE NOT NULL,
        site_id     INT  NOT NULL,
        check_in    DATE NOT NULL,
        check_out   DATE NOT NULL,
        people      INT  NOT NULL,
        name        TEXT NOT NULL,
        phone       TEXT NOT NULL,
        total       INT  NOT NULL,
        status      TEXT NOT NULL DEFAULT 'confirmed',
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT no_overlap EXCLUDE USING gist
          (site_id WITH =, daterange(check_in, check_out) WITH &&)
          WHERE (status = 'confirmed')
      )`);
  })().catch(function (e) { schemaReady = null; throw e; });
  return schemaReady;
}

// ---------- 응답 도우미 ----------
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function handleError(res, e) {
  if (e && e.code === "DB_NOT_CONFIGURED") {
    return send(res, 503, { error: "서버 데이터베이스가 아직 연결되지 않았어요.", code: "DB_NOT_CONFIGURED" });
  }
  console.error(e);
  return send(res, 500, { error: "서버에 문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요." });
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) { try { return JSON.parse(req.body); } catch (e) { return {}; } }
  return {};
}

// ---------- 값 검사 ----------
function todayKST() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
function isDateStr(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !isNaN(d) && d.toISOString().slice(0, 10) === s;
}
function nightsBetween(a, b) {
  return Math.round((new Date(b + "T00:00:00Z") - new Date(a + "T00:00:00Z")) / 86400000);
}
function normPhone(p) { return String(p || "").replace(/\D/g, ""); }
function findSite(id) { return SITES.find(function (s) { return s.id === Number(id); }); }

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 헷갈리는 글자(0,O,1,I) 제외
function newCode() {
  const bytes = crypto.randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

// 예약 요청이 올바른지 검사. 문제가 있으면 한국어 메시지를 돌려줘요.
function validateReservation(b) {
  const site = findSite(b.siteId);
  if (!site) return { error: "없는 구역이에요." };
  if (!isDateStr(b.checkIn) || !isDateStr(b.checkOut)) return { error: "날짜 형식이 올바르지 않아요." };
  if (b.checkIn < todayKST()) return { error: "지난 날짜는 예약할 수 없어요." };
  const nights = nightsBetween(b.checkIn, b.checkOut);
  if (nights < 1) return { error: "퇴실일은 입실일보다 뒤여야 해요." };
  if (nights > 14) return { error: "한 번에 최대 14박까지 예약할 수 있어요." };
  const people = Number(b.people);
  if (!Number.isInteger(people) || people < 1 || people > site.capacity) {
    return { error: "인원은 1~" + site.capacity + "명까지 가능해요." };
  }
  const name = String(b.name || "").trim();
  if (name.length < 1 || name.length > 30) return { error: "이름을 1~30자로 입력해 주세요." };
  const phone = normPhone(b.phone);
  if (phone.length < 9 || phone.length > 11) return { error: "연락처를 올바르게 입력해 주세요." };
  return { ok: true, site: site, nights: nights, people: people, name: name, phone: phone,
           total: nights * site.price };
}

// DB 줄(row) → 화면에 보낼 모양
function toPublic(r) {
  return { code: r.code, siteId: r.site_id, checkIn: r.check_in, checkOut: r.check_out,
           people: r.people, name: r.name, phone: r.phone, total: r.total, status: r.status, createdAt: r.created_at };
}

const COLUMNS = `code, site_id, to_char(check_in,'YYYY-MM-DD') AS check_in,
  to_char(check_out,'YYYY-MM-DD') AS check_out, people, name, phone, total, status, created_at`;

module.exports = {
  getSql, ensureSchema, send, handleError, readBody, todayKST, isDateStr, nightsBetween,
  normPhone, findSite, newCode, validateReservation, toPublic, COLUMNS, _setSqlForTest,
};
