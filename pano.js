// ===== 360도 파노라마 그리기 =====
// 지도 좌표(world.js)를 보고, 서 있는 위치에서 사방이 어떻게 보일지 계산해서
// 가로 2배 비율(equirectangular)의 파노라마 이미지 한 장을 그려요.

const PANO_W = 3072;
const PANO_H = 1536;
const CAM_H = 14;                 // 눈높이 (지도 단위)
const HAZE = [196, 224, 244];     // 먼 곳이 흐려지는 색 (하늘 색과 같게)

// ---------- 작은 도우미 ----------
function hash2(x, y) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smoothNoise(x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const a = hash2(x0, y0), b = hash2(x0 + 1, y0), c = hash2(x0, y0 + 1), d = hash2(x0 + 1, y0 + 1);
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

// ---------- 하늘 ----------
function drawSky(ctx, W, H) {
  const g = ctx.createLinearGradient(0, 0, 0, H / 2);
  g.addColorStop(0, "#3a78c4");
  g.addColorStop(0.55, "#86b9e6");
  g.addColorStop(1, "#c4e0f4");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H / 2);
  ctx.fillStyle = "#b5cdb0";
  ctx.fillRect(0, H / 2, W, H / 2);

  // 해
  const sx = (120 + 180) / 360 * W, sy = H / 2 - (34 / 180) * H;
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 260);
  sg.addColorStop(0, "rgba(255,250,220,1)");
  sg.addColorStop(0.08, "rgba(255,246,200,0.95)");
  sg.addColorStop(0.2, "rgba(255,240,190,0.35)");
  sg.addColorStop(1, "rgba(255,240,190,0)");
  ctx.fillStyle = sg;
  ctx.fillRect(sx - 270, sy - 270, 540, 540);

  // 구름
  const r = mulberry32(77);
  for (let i = 0; i < 18; i++) {
    const cx = 150 + r() * (W - 300);
    const el = 7 + r() * 40;
    const cy = H / 2 - (el / 180) * H;
    const size = 40 + r() * 70;
    ctx.fillStyle = "rgba(255,255,255," + (0.55 + r() * 0.3) + ")";
    for (let j = 0; j < 6; j++) {
      ctx.beginPath();
      ctx.ellipse(cx + (j - 2.5) * size * 0.55, cy + (r() - 0.5) * size * 0.25,
        size * (0.7 + r() * 0.4), size * (0.28 + r() * 0.15), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 먼 산 (방향마다 높이가 다르게, 360도 한 바퀴 이어지게)
  function ridge(color, f) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H / 2);
    for (let x = 0; x <= W; x += 4) {
      const a = x / W * Math.PI * 2;
      const e = f(a);
      ctx.lineTo(x, H / 2 - (e / 180) * H);
    }
    ctx.lineTo(W, H / 2);
    ctx.closePath();
    ctx.fill();
  }
  ridge("#8ea9c4", function (a) { return 5 + 3.2 * Math.sin(2 * a + 1) + 2 * Math.sin(5 * a + 2) + 1.2 * Math.sin(9 * a); });
  ridge("#6f93a0", function (a) { return 2.6 + 1.8 * Math.sin(3 * a + 4) + 1.1 * Math.sin(7 * a + 1) + 0.6 * Math.sin(13 * a); });
  ridge("#527a62", function (a) { return 1.0 + 0.7 * Math.sin(4 * a + 2) + 0.5 * Math.sin(11 * a + 5); });
}

// ---------- 땅 (픽셀마다 "지도에서 이 자리는 무엇인지" 계산) ----------
const G = [0, 0, 0]; // 계산 결과 색을 담는 상자

function setC(r, g, b) { G[0] = r; G[1] = g; G[2] = b; }

function groundColor(wx, wy, d) {
  const gx = Math.floor(wx / 2.5), gy = Math.floor(wy / 2.5);
  // 가까운 바닥은 아주 잘게(자갈/풀 느낌), 먼 곳은 무늬를 줄여서 깔끔하게
  const grain = Math.max(0.2, 1 - d / 300);
  const n = (hash2(Math.floor(wx / 0.15), Math.floor(wy / 0.15)) - 0.5) * grain;
  const big = smoothNoise(wx / 40, wy / 40) - 0.5;

  // 외부 주차장
  const E = GEO.ext;
  if (wx >= E.x && wx <= E.x + E.w && wy >= E.y && wy <= E.y + E.h) {
    const line = ((wx - E.x) % 55) < 1.6 && (wy > E.y + 8) && (wy < E.y + E.h - 6);
    const v = 108 + n * 12;
    if (line) setC(230, 230, 225); else setC(v, v + 2, v + 6);
    return;
  }

  // 강
  const dr = Math.abs(wy - riverCenter(wx));
  if (dr < RIVER_HALF) {
    const rip = Math.sin(wx / 7 + Math.sin(wy / 5) * 2.2) + Math.sin(wx / 19 - wy / 9);
    const light = rip > 1.15 ? 38 : (rip > 0.6 ? 14 : 0);
    const edge = dr > RIVER_HALF - 4 ? 22 : 0;
    setC(52 + light + edge, 132 + light + edge, 188 + light * 0.6 + edge * 0.3);
    return;
  }
  if (dr < RIVER_HALF + 8 && wy > 355 && wy < 490) {
    const v = 168 + n * 40;
    setC(v, v - 8, v - 38); // 모래·자갈 강변
    return;
  }

  // 사이트 바닥 (오토캠핑=파쇄석, 데크/글램핑=나무 데크)
  for (let i = 0; i < SITE_PADS.length; i++) {
    const p = SITE_PADS[i];
    if (wx > p.x - 55 && wx < p.x + 55 && wy > p.y - 24 && wy < p.y + 24) {
      if (p.deck && wx > p.x - 50 && wx < p.x + 50 && wy > p.y - 21 && wy < p.y + 21) {
        const u = (wy - (p.y - 21)) / 5;
        const idx = Math.floor(u);
        const f = u - idx;
        const shade = 0.9 + 0.22 * hash2(idx, p.id);
        const k = f < 0.1 ? 0.62 : shade;
        setC(176 * k, 128 * k, 82 * k);
      } else {
        const v = 170 + n * 34;
        setC(v, v - 4, v - 16);
      }
      return;
    }
  }

  // 캠프파이어장
  const fr = Math.hypot(wx - GEO.fire.cx, wy - GEO.fire.cy);
  if (fr < GEO.fire.r) {
    if (fr < 16) { const o = hash2(gx, gy) > 0.82; setC(o ? 220 : 52, o ? 110 : 40, o ? 40 : 36); }
    else if (fr < 34) setC(96 + n * 20, 88 + n * 20, 82 + n * 20);
    else if (fr < 42) { const st = hash2(Math.floor(Math.atan2(wy - GEO.fire.cy, wx - GEO.fire.cx) * 9), 5); setC(118 + st * 40, 116 + st * 40, 112 + st * 40); }
    else setC(176 + n * 24, 170 + n * 24, 154 + n * 24);
    return;
  }

  // 잔디 놀이터
  const L = GEO.lawn;
  if (Math.pow((wx - L.cx) / L.rx, 2) + Math.pow((wy - L.cy) / L.ry, 2) < 1) {
    const stripe = Math.floor(wx / 14) % 2 === 0 ? 8 : -6;
    setC(118 + stripe + n * 16, 196 + stripe + n * 18, 84 + n * 12);
    return;
  }

  // E 존 주차 라인
  const R = GEO.eRing;
  const rn = Math.sqrt(Math.pow((wx - R.cx) / R.rx, 2) + Math.pow((wy - R.cy) / R.ry, 2));
  if (Math.abs(rn - 1) < 0.075) {
    const v = 168 + n * 26;
    setC(v, v - 5, v - 18);
    return;
  }

  // I 존 주차 라인
  const P = GEO.iPark;
  if (wx >= P.x && wx <= P.x + P.w && wy >= P.y && wy <= P.y + P.h) {
    const v = 166 + n * 24;
    setC(v, v - 5, v - 16);
    return;
  }

  // 풀밭 (존 안쪽은 정돈된 연두색, 바깥은 짙은 풀색)
  const inE = wx > 20 && wx < 980 && wy > 20 && wy < 355;
  const inI = wx > 20 && wx < 980 && wy > 490 && wy < 740;
  if (inE) setC(150 + n * 20 + big * 30, 186 + n * 22 + big * 24, 104 + n * 14);
  else if (inI) setC(140 + n * 20 + big * 30, 178 + n * 22 + big * 24, 116 + n * 14);
  else setC(112 + n * 22 + big * 40, 150 + n * 24 + big * 36, 90 + n * 16);
}

let SITE_PADS = null;
function buildPads() {
  SITE_PADS = SITES.map(function (s) {
    const p = SITE_POS[s.id];
    return { x: p.x, y: p.y, id: s.id, deck: s.type !== "오토캠핑" };
  });
}

function drawGround(ctx, W, H, px, py) {
  if (!SITE_PADS) buildPads();
  const gh = H / 2;
  const img = ctx.createImageData(W, gh);
  const data = img.data;
  const sinA = new Float32Array(W), cosA = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    const az = ((x + 0.5) / W) * Math.PI * 2 - Math.PI;
    sinA[x] = Math.sin(az); cosA[x] = Math.cos(az);
  }
  for (let r = 0; r < gh; r++) {
    const depression = ((r + 0.5) / H) * Math.PI;       // 수평선 아래로 몇 라디안?
    let d = CAM_H / Math.tan(depression);
    if (d > 6000) d = 6000;
    if (d < 1.5) d = 1.5;
    const haze = Math.min(1, Math.pow(d / 2400, 0.75));
    const hz = 1 - haze;
    let idx = r * W * 4;
    for (let x = 0; x < W; x++) {
      const wx = px + d * sinA[x];
      const wy = py - d * cosA[x];
      groundColor(wx, wy, d);
      data[idx++] = G[0] * hz + HAZE[0] * haze;
      data[idx++] = G[1] * hz + HAZE[1] * haze;
      data[idx++] = G[2] * hz + HAZE[2] * haze;
      data[idx++] = 255;
    }
  }
  ctx.putImageData(img, 0, H / 2);
}

// ---------- 물체 그리기 (나무, 텐트, 건물...) ----------
function ell(ctx, cx, cy, rx, ry) { ctx.beginPath(); ctx.ellipse(cx, cy, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); ctx.fill(); }
function rect(ctx, x, y, w, h) { ctx.fillRect(x, y, Math.max(0, w), Math.max(0, h)); }

function label(ctx, text, cx, cy, size, color) {
  if (size < 6) return;
  ctx.fillStyle = color;
  ctx.font = "bold " + Math.round(size) + "px 'Malgun Gothic','맑은 고딕',sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, cx, cy);
}

const SPRITES = {
  tree: function (ctx, cx, yT, yB, w, o) {
    const h = yB - yT;
    const tw = Math.max(1.5, w * 0.14);
    ctx.fillStyle = "#5e4430";
    rect(ctx, cx - tw / 2, yB - h * 0.38, tw, h * 0.38);
    const s = o.s;
    if (o.v === 0) { // 침엽수
      for (let i = 0; i < 3; i++) {
        const y0 = yT + h * 0.2 * i, y1 = yT + h * (0.5 + i * 0.17);
        const wi = w * (0.5 + 0.24 * i);
        ctx.fillStyle = "rgb(" + Math.round(26 + s * 22 + i * 6) + "," + Math.round(82 + s * 40 + i * 10) + "," + Math.round(50 + s * 20) + ")";
        ctx.beginPath(); ctx.moveTo(cx, y0); ctx.lineTo(cx + wi / 2, y1); ctx.lineTo(cx - wi / 2, y1); ctx.closePath(); ctx.fill();
      }
    } else { // 활엽수
      ctx.fillStyle = "rgb(" + Math.round(52 + s * 30) + "," + Math.round(118 + s * 40) + "," + Math.round(56 + s * 20) + ")";
      ell(ctx, cx, yT + h * 0.32, w * 0.5, h * 0.32);
      ell(ctx, cx - w * 0.24, yT + h * 0.46, w * 0.32, h * 0.22);
      ell(ctx, cx + w * 0.25, yT + h * 0.46, w * 0.32, h * 0.22);
      ctx.fillStyle = "rgba(190,230,120,0.28)";
      ell(ctx, cx - w * 0.1, yT + h * 0.22, w * 0.25, h * 0.14);
    }
  },

  dome: function (ctx, cx, yT, yB, w, o) {
    const h = yB - yT;
    ctx.fillStyle = o.color;
    ctx.beginPath(); ctx.ellipse(cx, yB, w / 2, h, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath(); ctx.ellipse(cx - w * 0.12, yB, w * 0.32, h * 0.8, 0, Math.PI, Math.PI * 1.7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#1f2428";
    ctx.beginPath(); ctx.ellipse(cx + w * 0.12, yB, w * 0.14, h * 0.55, 0, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    rect(ctx, cx - w / 2, yB - h * 0.06, w, h * 0.06);
  },

  glamp: function (ctx, cx, yT, yB, w) {
    const h = yB - yT;
    ctx.fillStyle = "#ece0c0";
    rect(ctx, cx - w / 2, yT + h * 0.4, w, h * 0.6);
    ctx.fillStyle = "#c9a876";
    ctx.beginPath(); ctx.moveTo(cx - w * 0.56, yT + h * 0.42); ctx.lineTo(cx, yT); ctx.lineTo(cx + w * 0.56, yT + h * 0.42); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffd98a";
    rect(ctx, cx - w * 0.28, yT + h * 0.52, w * 0.2, h * 0.3);
    rect(ctx, cx + w * 0.08, yT + h * 0.52, w * 0.2, h * 0.3);
    ctx.fillStyle = "#6b4a2f";
    rect(ctx, cx - w * 0.05, yT + h * 0.5, w * 0.1, h * 0.5);
    ctx.fillStyle = "rgba(255,230,140,0.95)"; // 전구 장식
    for (let i = 0; i < 9; i++) ell(ctx, cx - w * 0.5 + w * i / 8, yT + h * 0.42, Math.max(0.8, w * 0.012), Math.max(0.8, w * 0.012));
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    rect(ctx, cx - w / 2, yB - h * 0.05, w, h * 0.05);
  },

  table: function (ctx, cx, yT, yB, w) {
    const h = yB - yT;
    ctx.fillStyle = "#7b5a3a";
    rect(ctx, cx - w * 0.3, yT + h * 0.35, w * 0.6, h * 0.14);
    rect(ctx, cx - w * 0.26, yT + h * 0.49, Math.max(1, w * 0.05), h * 0.51);
    rect(ctx, cx + w * 0.21, yT + h * 0.49, Math.max(1, w * 0.05), h * 0.51);
    ctx.fillStyle = "#3d6b8f";
    rect(ctx, cx - w * 0.48, yT + h * 0.55, w * 0.14, h * 0.45);
    rect(ctx, cx + w * 0.34, yT + h * 0.55, w * 0.14, h * 0.45);
  },

  plate: function (ctx, cx, yT, yB, w, o) {
    const h = yB - yT;
    ctx.fillStyle = "#5a4630";
    rect(ctx, cx - Math.max(0.8, w * 0.06), yT + h * 0.3, Math.max(1.6, w * 0.12), h * 0.7);
    ctx.fillStyle = o.zone === "E" ? "#e9962f" : "#4f86c0";
    rect(ctx, cx - w / 2, yT, w, h * 0.42);
    ctx.fillStyle = "#fff";
    label(ctx, o.label, cx, yT + h * 0.21, Math.min(h * 0.3, w * 0.5), "#ffffff");
  },

  board: function (ctx, cx, yT, yB, w, o, photos) {
    const h = yB - yT;
    ctx.fillStyle = "#5a4630";
    rect(ctx, cx - w * 0.36, yT + h * 0.5, Math.max(1, w * 0.05), h * 0.5);
    rect(ctx, cx + w * 0.31, yT + h * 0.5, Math.max(1, w * 0.05), h * 0.5);
    const fx = cx - w / 2, fy = yT, fw = w, fh = h * 0.6;
    ctx.fillStyle = "#f4efe3";
    rect(ctx, fx - 2, fy - 2, fw + 4, fh + 4);
    ctx.strokeStyle = "#6b4a2f";
    ctx.lineWidth = Math.max(1, w * 0.04);
    ctx.strokeRect(fx - 2, fy - 2, fw + 4, fh + 4);
    const im = photos && photos[o.siteId];
    if (im && im.naturalWidth) {
      ctx.drawImage(im, fx, fy, fw, fh);
    } else {
      ctx.fillStyle = "#dfe9d9";
      rect(ctx, fx, fy, fw, fh);
      label(ctx, "📷", cx, fy + fh / 2, fh * 0.45, "#2f5d3a");
    }
  },

  bldg: function (ctx, cx, yT, yB, w, o) {
    const h = yB - yT;
    ctx.fillStyle = "#d8cdb6";
    rect(ctx, cx - w / 2, yT + h * 0.22, w, h * 0.78);
    ctx.fillStyle = "#7a5a43";
    ctx.beginPath(); ctx.moveTo(cx - w * 0.56, yT + h * 0.28); ctx.lineTo(cx - w * 0.4, yT); ctx.lineTo(cx + w * 0.4, yT); ctx.lineTo(cx + w * 0.56, yT + h * 0.28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#5b4636";
    rect(ctx, cx - w * 0.08, yT + h * 0.55, w * 0.16, h * 0.45);
    ctx.fillStyle = "#a8c4d6";
    rect(ctx, cx - w * 0.36, yT + h * 0.45, w * 0.16, h * 0.2);
    rect(ctx, cx + w * 0.2, yT + h * 0.45, w * 0.16, h * 0.2);
    label(ctx, o.label, cx, yT + h * 0.12, Math.min(h * 0.2, w * 0.2), "#ffffff");
  },

  car: function (ctx, cx, yT, yB, w, o) {
    const h = yB - yT;
    ctx.fillStyle = o.color;
    rect(ctx, cx - w / 2, yT + h * 0.38, w, h * 0.45);
    ctx.beginPath(); ctx.moveTo(cx - w * 0.3, yT + h * 0.4); ctx.lineTo(cx - w * 0.2, yT); ctx.lineTo(cx + w * 0.2, yT); ctx.lineTo(cx + w * 0.34, yT + h * 0.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#bcd6e6";
    ctx.beginPath(); ctx.moveTo(cx - w * 0.24, yT + h * 0.36); ctx.lineTo(cx - w * 0.17, yT + h * 0.1); ctx.lineTo(cx + w * 0.17, yT + h * 0.1); ctx.lineTo(cx + w * 0.28, yT + h * 0.36); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#1b1b1b";
    ell(ctx, cx - w * 0.28, yB - h * 0.14, w * 0.1, h * 0.14);
    ell(ctx, cx + w * 0.28, yB - h * 0.14, w * 0.1, h * 0.14);
  },

  fire: function (ctx, cx, yT, yB, w) {
    const h = yB - yT;
    const gl = ctx.createRadialGradient(cx, yB - h * 0.35, 0, cx, yB - h * 0.35, h * 1.1);
    gl.addColorStop(0, "rgba(255,170,60,0.55)"); gl.addColorStop(1, "rgba(255,140,40,0)");
    ctx.fillStyle = gl;
    rect(ctx, cx - h * 1.1, yB - h * 1.5, h * 2.2, h * 2.2);
    ctx.strokeStyle = "#4a3222"; ctx.lineWidth = Math.max(2, w * 0.12); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx - w * 0.55, yB - h * 0.05); ctx.lineTo(cx + w * 0.45, yB - h * 0.28);
    ctx.moveTo(cx + w * 0.55, yB - h * 0.05); ctx.lineTo(cx - w * 0.45, yB - h * 0.28); ctx.stroke();
    const cols = ["#e8571a", "#f7961e", "#ffd54a"];
    for (let i = 0; i < 3; i++) {
      const k = 1 - i * 0.28;
      ctx.fillStyle = cols[i];
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.38 * k, yB - h * 0.2);
      ctx.bezierCurveTo(cx - w * 0.5 * k, yB - h * 0.55 * k, cx - w * 0.05, yB - h * 0.6 * k, cx, yT + h * 0.1 + i * h * 0.16);
      ctx.bezierCurveTo(cx + w * 0.1, yB - h * 0.6 * k, cx + w * 0.5 * k, yB - h * 0.55 * k, cx + w * 0.38 * k, yB - h * 0.2);
      ctx.closePath(); ctx.fill();
    }
  },

  goal: function (ctx, cx, yT, yB, w) {
    const h = yB - yT;
    ctx.strokeStyle = "#f2f2f2"; ctx.lineWidth = Math.max(1.5, w * 0.04); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx - w / 2, yB); ctx.lineTo(cx - w / 2, yT); ctx.lineTo(cx + w / 2, yT); ctx.lineTo(cx + w / 2, yB); ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 1;
    for (let i = 1; i < 7; i++) { ctx.beginPath(); ctx.moveTo(cx - w / 2 + w * i / 7, yT); ctx.lineTo(cx - w / 2 + w * i / 7, yB); ctx.stroke(); }
  },

  arch: function (ctx, cx, yT, yB, w) {
    const h = yB - yT;
    ctx.fillStyle = "#6b4a2f";
    rect(ctx, cx - w / 2, yT, w * 0.09, h);
    rect(ctx, cx + w / 2 - w * 0.09, yT, w * 0.09, h);
    ctx.fillStyle = "#2f5d3a";
    rect(ctx, cx - w * 0.54, yT, w * 1.08, h * 0.28);
    label(ctx, "🌲 홍지수캠핑장", cx, yT + h * 0.14, Math.min(h * 0.17, w * 0.1), "#ffffff");
  },

  zonesign: function (ctx, cx, yT, yB, w, o) {
    const h = yB - yT;
    ctx.fillStyle = "#5a4630";
    rect(ctx, cx - w * 0.3, yT + h * 0.5, Math.max(1.5, w * 0.06), h * 0.5);
    rect(ctx, cx + w * 0.27, yT + h * 0.5, Math.max(1.5, w * 0.06), h * 0.5);
    ctx.fillStyle = o.color;
    rect(ctx, cx - w / 2, yT, w, h * 0.55);
    label(ctx, o.label, cx, yT + h * 0.2, Math.min(h * 0.24, w * 0.2), "#ffffff");
    label(ctx, o.sub, cx, yT + h * 0.4, Math.min(h * 0.11, w * 0.085), "#ffffff");
  },
};

function drawObjects(ctx, W, H, px, py, photos) {
  const list = [];
  WORLD_OBJECTS.forEach(function (o) {
    const dx = o.x - px, dy = o.y - py;
    const d = Math.hypot(dx, dy);
    if (d < 14) return;
    list.push({ o: o, d: d, dx: dx, dy: dy });
  });
  list.sort(function (a, b) { return b.d - a.d; }); // 먼 것부터 그려야 가까운 게 위에 덮임
  const k = H / Math.PI;
  list.forEach(function (it) {
    const o = it.o, d = it.d;
    const az = Math.atan2(it.dx, -it.dy);
    const cx = (az + Math.PI) / (2 * Math.PI) * W;
    const yB = H / 2 + Math.atan(CAM_H / d) * k;
    const yT = H / 2 - Math.atan((o.h - CAM_H) / d) * k;
    const wpx = 2 * Math.atan(o.w / (2 * d)) * k;
    if (wpx < 1.2 || yB - yT < 1.2) return;
    const fn = SPRITES[o.t];
    [-W, 0, W].forEach(function (off) {
      const x = cx + off;
      if (x + wpx / 2 < 0 || x - wpx / 2 > W) return;
      fn(ctx, x, yT, yB, wpx, o, photos);
    });
  });
}

// ---------- 한 장면 완성 ----------
function renderPano(scene, photos) {
  const cv = document.createElement("canvas");
  cv.width = PANO_W; cv.height = PANO_H;
  const ctx = cv.getContext("2d");
  drawSky(ctx, PANO_W, PANO_H);
  drawGround(ctx, PANO_W, PANO_H, scene.x, scene.y);
  drawObjects(ctx, PANO_W, PANO_H, scene.x, scene.y, photos);
  return cv;
}
