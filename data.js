// ===== 캠핑장 데이터 (나중에 여기만 고치면 사이트 내용이 바뀜) =====

const CAMP_NAME = "홍지수캠핑장";

// 구역(사이트) 목록. price = 1박 가격(원), capacity = 최대 인원
const SITES = [
  { id: 1, name: "A-1 파쇄석 오토캠핑", type: "오토캠핑", price: 40000, capacity: 4, emoji: "⛺",
    desc: "차를 바로 옆에 세울 수 있는 기본 구역이에요. 전기 사용 가능, 화로대 대여 가능." },
  { id: 2, name: "A-2 파쇄석 오토캠핑", type: "오토캠핑", price: 40000, capacity: 4, emoji: "⛺",
    desc: "A-1 옆 구역이에요. 친구 가족과 함께 오기 좋아요." },
  { id: 3, name: "B-1 데크 사이트", type: "데크", price: 55000, capacity: 5, emoji: "🏕️",
    desc: "평평한 나무 데크라 비 온 뒤에도 쾌적해요. 아이들 놀기에 좋아요." },
  { id: 4, name: "B-2 데크 사이트", type: "데크", price: 55000, capacity: 5, emoji: "🏕️",
    desc: "계곡 소리가 들리는 데크 구역이에요." },
  { id: 5, name: "C-1 가족 글램핑", type: "글램핑", price: 120000, capacity: 4, emoji: "🛖",
    desc: "침대, 에어컨, 바비큐 세트가 준비돼 있어 몸만 오면 돼요." },
  { id: 6, name: "C-2 대형 글램핑", type: "글램핑", price: 160000, capacity: 6, emoji: "🏡",
    desc: "대가족용 넓은 글램핑이에요. 화장실이 객실 안에 있어요." },
];

// 이미 예약이 차 있는 날짜 (시연용 가짜 예약)
// checkIn(입실) ~ checkOut(퇴실) 형식: "YYYY-MM-DD"
const DEMO_RESERVATIONS = [
  { siteId: 1, checkIn: "2026-11-14", checkOut: "2026-11-16" },
  { siteId: 3, checkIn: "2026-11-20", checkOut: "2026-11-22" },
  { siteId: 5, checkIn: "2026-11-13", checkOut: "2026-11-15" },
];
