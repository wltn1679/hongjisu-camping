// ===== 모든 페이지가 같이 쓰는 함수들 =====

const STORAGE_KEY = "hjs_camp_reservations";

// 저장된 내 예약 불러오기 (localStorage = 브라우저 안의 작은 저장공간)
function getMyReservations() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveMyReservations(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ===== 서버 연결 =====
// 서버(/api)가 연결돼 있으면 예약이 서버 DB에 저장돼요 (API_MODE).
// 서버가 없거나 아직 준비 안 됐으면 예전처럼 이 브라우저에만 저장하는 "데모 모드"로 자동 전환돼요.
let API_MODE = false;
let BOOKED = []; // 서버에서 받은 "예약이 찬 날짜" (개인정보 없음)
const CODES_KEY = "hjs_camp_codes";

async function api(path, options) {
  const res = await fetch(path, Object.assign({ cache: "no-store" }, options || {}));
  let json = {};
  try { json = await res.json(); } catch (e) {}
  return { status: res.status, ok: res.ok, json: json };
}

async function initBookings() {
  try {
    const r = await api("/api/availability");
    if (r.ok && Array.isArray(r.json.bookings)) { BOOKED = r.json.bookings; API_MODE = true; return; }
  } catch (e) {}
  API_MODE = false;
}

// 이름·메모처럼 사람이 입력한 글을 화면에 넣을 때는 꼭 이걸로 감싸요 (악성 코드 방지)
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

// 데모 모드일 때 위에 띄우는 안내
function showDemoBanner() {
  const m = document.querySelector("main");
  if (API_MODE || !m || document.getElementById("demoBanner")) return;
  const d = document.createElement("div");
  d.id = "demoBanner";
  d.className = "demo-banner";
  d.innerHTML = "⚠️ <b>데모 모드</b> · 서버가 연결되지 않아 예약이 <b>이 브라우저에만</b> 저장돼요.";
  m.prepend(d);
}

// 내 브라우저에 기억해 둔 예약번호들 (서버 모드에서 "내 예약" 목록을 보여주기 위함)
function getSavedCodes() {
  try { return JSON.parse(localStorage.getItem(CODES_KEY)) || []; } catch (e) { return []; }
}
function saveCode(code, phone) {
  const list = getSavedCodes().filter(function (x) { return x.code !== code; });
  list.push({ code: code, phone: String(phone).replace(/\D/g, "") });
  try { localStorage.setItem(CODES_KEY, JSON.stringify(list)); } catch (e) {}
}
function forgetCode(code) {
  const list = getSavedCodes().filter(function (x) { return x.code !== code; });
  try { localStorage.setItem(CODES_KEY, JSON.stringify(list)); } catch (e) {}
}

// 예약 만들기. 성공하면 { ok:true, reservation }, 실패하면 { ok:false, error }
async function createReservation(data) {
  if (API_MODE) {
    try {
      const r = await api("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (r.ok) { saveCode(r.json.reservation.code, data.phone); return { ok: true, reservation: r.json.reservation }; }
      return { ok: false, error: r.json.error || "예약하지 못했어요. 잠시 뒤에 다시 시도해 주세요." };
    } catch (e) {
      return { ok: false, error: "서버에 연결하지 못했어요. 인터넷을 확인해 주세요." };
    }
  }
  // 데모 모드: 이 브라우저에만 저장
  const site = findSite(data.siteId);
  const nights = countNights(data.checkIn, data.checkOut);
  const rec = {
    id: Date.now(), code: "DEMO" + String(Date.now()).slice(-4), siteId: data.siteId,
    checkIn: data.checkIn, checkOut: data.checkOut, people: data.people,
    name: data.name, phone: data.phone, total: nights * site.price, status: "confirmed",
  };
  const list = getMyReservations();
  list.push(rec);
  saveMyReservations(list);
  return { ok: true, reservation: rec };
}

// 전체 예약 현황 (날짜 겹침 확인용)
function getAllReservations() {
  if (API_MODE) return BOOKED;
  return DEMO_RESERVATIONS.concat(getMyReservations());
}

// 숙박 일수 계산 (퇴실일 - 입실일)
function countNights(checkIn, checkOut) {
  const ms = new Date(checkOut) - new Date(checkIn);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// ★ 핵심: 이 구역이 그 날짜에 비어 있는지 확인
// 두 기간이 겹치는 조건: 새입실 < 기존퇴실  그리고  새퇴실 > 기존입실
function isAvailable(siteId, checkIn, checkOut) {
  return !getAllReservations().some(function (r) {
    return r.siteId === siteId && checkIn < r.checkOut && checkOut > r.checkIn;
  });
}

function formatPrice(n) {
  return n.toLocaleString("ko-KR") + "원";
}

function findSite(id) {
  return SITES.find(function (s) { return s.id === id; });
}

// 구역 사진 HTML. 사진 파일이 없으면 자동으로 사라지고 이모지가 보임
function sitePicHtml(site, big) {
  return '<div class="pic' + (big ? ' big' : '') + '">' + site.emoji +
    '<img src="' + site.photo + '" alt="' + site.name + '" onerror="this.remove()">' +
    '</div>';
}

// 존(E/I) 안내 박스 HTML
function zoneNoticeHtml(site) {
  const z = ZONE_INFO[site.zone];
  let li = "";
  z.rules.forEach(function (r) { li += "<li>" + r + "</li>"; });
  return '<div class="zone-notice zone-' + site.zone + '">' +
    '<h3>' + z.name + '</h3><p><b>' + z.short + '</b></p><ul>' + li + '</ul></div>';
}

function todayString() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + m + "-" + day;
}
