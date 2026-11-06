// ===== 가상 캠핑장 월드 (지도 좌표 0~1000 x 0~850 기준) =====
// 지도(map.html)와 로드뷰(tour.html)가 같은 좌표를 써서, 지도에서 본 위치가 로드뷰에도 똑같이 나와요.
// 지도에서 위쪽이 북쪽(0도), 시계 방향으로 각도가 늘어요.

const SITE_SIZE = { w: 110, h: 48 };
const RIVER_HALF = 30; // 강 폭의 절반

// 큰 강의 중심선 (x 위치에 따라 y가 구불구불하게 변함)
function riverCenter(x) {
  return 420 + 16 * Math.sin(x / 110) + 8 * Math.sin(x / 37);
}

// 각 사이트의 지도 위치 (E 존은 타원으로 둘러서, I 존은 강을 따라 한 줄로)
const SITE_POS = {};
(function () {
  const angles = [-150, -90, -30, 30, 90, 150];
  let ei = 0, ii = 0;
  SITES.forEach(function (s) {
    if (s.zone === "E") {
      const t = angles[ei++] * Math.PI / 180;
      SITE_POS[s.id] = { x: 500 + 340 * Math.cos(t), y: 185 + 125 * Math.sin(t) };
    } else {
      SITE_POS[s.id] = { x: 215 + ii * 190, y: 560 };
      ii++;
    }
  });
})();

// 고정 지형
const GEO = {
  eZone: { x: 20, y: 20, w: 960, h: 335 },
  iZone: { x: 20, y: 490, w: 960, h: 250 },
  ext: { x: 20, y: 758, w: 960, h: 72 },          // 외부 주차장
  lawn: { cx: 390, cy: 190, rx: 110, ry: 55 },    // 잔디 놀이터
  fire: { cx: 620, cy: 190, r: 48 },              // 대형 캠프파이어
  eRing: { cx: 500, cy: 185, rx: 275, ry: 92 },   // E 존 주차 라인
  iPark: { x: 120, y: 605, w: 760, h: 36 },       // I 존 주차 라인
};

// 편의시설 (사이트 뒤편)
const FACILITIES = [
  { x: 32, y: 62, w: 105, h: 52, label: "화장실" },
  { x: 32, y: 136, w: 105, h: 52, label: "샤워실" },
  { x: 32, y: 210, w: 105, h: 52, label: "취사장" },
  { x: 863, y: 62, w: 105, h: 52, label: "화장실" },
  { x: 863, y: 136, w: 105, h: 52, label: "샤워실" },
  { x: 863, y: 210, w: 105, h: 52, label: "취사장" },
  { x: 150, y: 662, w: 200, h: 56, label: "화장실" },
  { x: 400, y: 662, w: 200, h: 56, label: "샤워실" },
  { x: 650, y: 662, w: 200, h: 56, label: "취사장" },
];

// ===== 로드뷰 장면(서 있는 위치) =====
function bearingDeg(a, b) {
  return Math.atan2(b.x - a.x, -(b.y - a.y)) * 180 / Math.PI;
}

function inwardPoint(id, dist) {
  const p = SITE_POS[id];
  const vx = 500 - p.x, vy = 185 - p.y;
  const l = Math.hypot(vx, vy);
  return { x: p.x + vx / l * dist, y: p.y + vy / l * dist };
}

const SCENES = [];
const SCENE_BY_ID = {};
function addScene(sc) { SCENES.push(sc); SCENE_BY_ID[sc.id] = sc; }

addScene({ id: "gate", name: "정문 · 입구 주차장", x: 500, y: 805, zone: "", look: 0,
  desc: "홍지수캠핑장 입구예요. 추가 차량은 이 주차장에 세우고, 정문을 지나 캠핑장 안으로 들어가세요." });
addScene({ id: "ifac", name: "I 존 편의시설", x: 500, y: 650, zone: "I", look: 180,
  desc: "I 존 사이트 뒤편 편의시설이에요. 화장실, 샤워실, 취사장이 모여 있어요." });

SITES.forEach(function (s) {
  if (s.zone !== "I") return;
  const p = SITE_POS[s.id];
  addScene({ id: "s" + s.id, siteId: s.id, name: s.name, x: p.x, y: p.y - 40, zone: "I",
    look: 180, desc: s.desc });
});
addScene({ id: "ibank", name: "I 존 강변", x: 500, y: 478, zone: "I", look: 0,
  desc: "I 존 강변이에요. 큰 강 건너편이 E 존이에요. 물소리와 경치를 즐기는 조용한 자리예요." });
addScene({ id: "ebank", name: "E 존 강변", x: 500, y: 372, zone: "E", look: 180,
  desc: "E 존 강변이에요. 큰 강 건너편이 매너타임을 꼭 지켜야 하는 I 존이에요." });
addScene({ id: "lawn", name: "잔디 놀이터", x: 385, y: 224, zone: "E", look: 0,
  desc: "아이들이 마음껏 뛰어놀 수 있는 넓은 잔디 놀이터예요." });
addScene({ id: "fire", name: "대형 캠프파이어", x: 545, y: 195, zone: "E", look: 90,
  desc: "E 존의 대형 캠프파이어장이에요. 저녁이면 캠퍼들이 모여 함께 즐겨요." });
addScene({ id: "efac", name: "E 존 편의시설", x: 175, y: 190, zone: "E", look: -90,
  desc: "E 존 사이트 뒤편 편의시설이에요. 화장실, 샤워실, 취사장이 있어요." });

SITES.forEach(function (s) {
  if (s.zone !== "E") return;
  const v = inwardPoint(s.id, 70);
  const p = SITE_POS[s.id];
  addScene({ id: "s" + s.id, siteId: s.id, name: s.name, x: v.x, y: v.y, zone: "E",
    look: bearingDeg(v, p), desc: s.desc });
});

// 장면 사이 연결 (화살표로 이동할 수 있는 길)
const SCENE_LINKS = [
  ["gate", "ifac"],
  ["ifac", "s8"], ["ifac", "s9"],
  ["s7", "s8"], ["s8", "s9"], ["s9", "s10"],
  ["s8", "ibank"], ["s9", "ibank"],
  ["ibank", "ebank"],
  ["ebank", "s5"],
  ["s5", "lawn"], ["s5", "fire"], ["s5", "s4"], ["s5", "s6"],
  ["s1", "s2"], ["s2", "s3"], ["s3", "s4"], ["s4", "s5"], ["s5", "s6"], ["s6", "s1"],
  ["lawn", "fire"], ["lawn", "s1"], ["lawn", "s6"], ["lawn", "s2"], ["lawn", "efac"],
  ["fire", "s3"], ["fire", "s4"], ["fire", "s2"],
  ["efac", "s1"], ["efac", "s6"],
];

function sceneNeighbors(id) {
  const out = [];
  SCENE_LINKS.forEach(function (l) {
    if (l[0] === id && SCENE_BY_ID[l[1]]) out.push(SCENE_BY_ID[l[1]]);
    else if (l[1] === id && SCENE_BY_ID[l[0]]) out.push(SCENE_BY_ID[l[0]]);
  });
  // 중복 제거
  return out.filter(function (s, i) { return out.indexOf(s) === i; });
}

// ===== 월드에 놓이는 물체들 (나무, 텐트, 건물, 자동차...) =====
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const WORLD_OBJECTS = (function () {
  const objs = [];
  const rnd = mulberry32(20261106);

  // 1) 사이트마다: 텐트, 테이블, 번호판, 사진 안내판
  const domeColors = ["#d9622b", "#2f6fb5", "#3f9a5b", "#c9a227", "#8a4fb0", "#c0392b"];
  SITES.forEach(function (s) {
    const p = SITE_POS[s.id];
    // 번호판/안내판을 사이트의 "앞쪽" 가장자리에 둠 (E 존은 중앙 쪽, I 존은 강 쪽)
    const sy = s.zone === "I" ? -30 : ((185 - p.y) > 0 ? 30 : -30);
    if (s.type === "글램핑") {
      objs.push({ t: "glamp", x: p.x, y: p.y, w: 62, h: 36 });
    } else {
      objs.push({ t: "dome", x: p.x - 18, y: p.y, w: 38, h: 23, color: domeColors[s.id % domeColors.length] });
      objs.push({ t: "table", x: p.x + 28, y: p.y + 4, w: 20, h: 9 });
    }
    objs.push({ t: "plate", x: p.x - 42, y: p.y + sy, w: 16, h: 22, label: s.name.split(" ")[0], zone: s.zone });
    objs.push({ t: "board", x: p.x + 42, y: p.y + sy, w: 34, h: 28, siteId: s.id });
  });

  // 2) 편의시설 건물
  FACILITIES.forEach(function (f) {
    objs.push({ t: "bldg", x: f.x + f.w / 2, y: f.y + f.h / 2, w: Math.max(f.w * 0.9, 60), h: 30, label: f.label });
  });

  // 3) 캠프파이어, 놀이터 골대, 정문, 존 안내판
  objs.push({ t: "fire", x: GEO.fire.cx, y: GEO.fire.cy, w: 34, h: 58 });
  objs.push({ t: "goal", x: 305, y: 180, w: 42, h: 20 });
  objs.push({ t: "goal", x: 478, y: 176, w: 42, h: 20 });
  objs.push({ t: "arch", x: 500, y: 748, w: 100, h: 52 });
  objs.push({ t: "zonesign", x: 500, y: 350, w: 64, h: 40, label: "E ZONE", sub: "어울림 · 매너타임 없음", color: "#e08a24" });
  objs.push({ t: "zonesign", x: 500, y: 494, w: 64, h: 40, label: "I ZONE", sub: "고요 · 매너타임 필수", color: "#3f78b5" });

  // 4) 자동차
  const carColors = ["#c0392b", "#2c3e50", "#ecf0f1", "#7f8c8d", "#2980b9", "#d4a017"];
  SITES.forEach(function (s, i) {
    if (rnd() > 0.65) return;
    const p = SITE_POS[s.id];
    let cx, cy;
    if (s.zone === "E") {
      const a = Math.atan2((p.y - 185) / 125, (p.x - 500) / 340);
      cx = 500 + 275 * Math.cos(a); cy = 185 + 92 * Math.sin(a);
    } else { cx = p.x; cy = 623; }
    if (SCENES.some(function (sc) { return Math.hypot(cx - sc.x, cy - sc.y) < 45; })) return;
    objs.push({ t: "car", x: cx, y: cy, w: 42, h: 15, color: carColors[i % carColors.length] });
  });
  for (let i = 0; i < 16; i++) {
    if (rnd() < 0.35) continue;
    const cx = 70 + i * 55, cy = 780 + (i % 2) * 28;
    // 사람이 서 있는 자리(시야) 바로 앞에는 차를 두지 않음
    if (SCENES.some(function (sc) { return Math.hypot(cx - sc.x, cy - sc.y) < 45; })) continue;
    objs.push({ t: "car", x: cx, y: cy, w: 42, h: 15, color: carColors[(i * 5) % carColors.length] });
  }

  // 5) 나무 (비어 있는 자리에 무작위로)
  function blocked(x, y) {
    if (x > GEO.ext.x && x < GEO.ext.x + GEO.ext.w && y > GEO.ext.y - 20 && y < GEO.ext.y + GEO.ext.h) return true;
    if (Math.abs(y - riverCenter(x)) < RIVER_HALF + 14) return true;
    for (const id in SITE_POS) {
      const p = SITE_POS[id];
      if (Math.abs(x - p.x) < SITE_SIZE.w / 2 + 28 && Math.abs(y - p.y) < SITE_SIZE.h / 2 + 34) return true;
    }
    const n = Math.sqrt(Math.pow((x - GEO.eRing.cx) / GEO.eRing.rx, 2) + Math.pow((y - GEO.eRing.cy) / GEO.eRing.ry, 2));
    if (n < 1.12) return true;
    if (x > GEO.iPark.x - 20 && x < GEO.iPark.x + GEO.iPark.w + 20 && y > GEO.iPark.y - 20 && y < GEO.iPark.y + GEO.iPark.h + 20) return true;
    for (let i = 0; i < FACILITIES.length; i++) {
      const f = FACILITIES[i];
      if (x > f.x - 28 && x < f.x + f.w + 28 && y > f.y - 28 && y < f.y + f.h + 28) return true;
    }
    for (let i = 0; i < SCENES.length; i++) {
      if (Math.hypot(x - SCENES[i].x, y - SCENES[i].y) < 48) return true;
    }
    if (Math.hypot(x - 500, y - 748) < 70) return true;
    return false;
  }
  let placed = 0, tries = 0;
  while (placed < 130 && tries < 4000) {
    tries++;
    const x = -160 + rnd() * 1320, y = -160 + rnd() * 1180;
    if (blocked(x, y)) continue;
    const inside = x > 20 && x < 980 && y > 20 && y < 740;
    if (inside && rnd() < 0.5) continue; // 안쪽은 듬성듬성
    const h = 70 + rnd() * 70;
    objs.push({ t: "tree", x: x, y: y, w: h * (0.5 + rnd() * 0.25), h: h, s: rnd(), v: rnd() < 0.55 ? 0 : 1 });
    placed++;
  }
  return objs;
})();
