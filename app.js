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

// 가짜 예약 + 내 예약을 합친 전체 예약
function getAllReservations() {
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
