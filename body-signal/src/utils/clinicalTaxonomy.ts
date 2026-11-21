import { DepartmentId } from '../types/health';

export interface BodyPartDefinition {
  id: string;
  departmentId: DepartmentId;
  ko: string;
  en: string;
  aliases: string[];
}

export const BODY_PART_CATALOG: readonly BodyPartDefinition[] = [
  // Front regions
  { id: 'front-head', departmentId: 'neurology', ko: '머리/안면', en: 'Head / Face', aliases: ['머리', '두통', '머리/두통', 'head', 'head / headache', 'headache'] },
  { id: 'front-neck', departmentId: 'orthopedics', ko: '목/경추', en: 'Neck', aliases: ['목', '경추', '목(앞)', 'neck / cervical', 'cervical'] },
  { id: 'front-shoulder-l', departmentId: 'orthopedics', ko: '왼쪽 어깨', en: 'Left Shoulder', aliases: ['어깨', 'shoulder'] },
  { id: 'front-shoulder-r', departmentId: 'orthopedics', ko: '오른쪽 어깨', en: 'Right Shoulder', aliases: ['shoulder'] },
  { id: 'front-chest', departmentId: 'internal_medicine', ko: '가슴/흉부', en: 'Chest', aliases: ['가슴', '흉부'] },
  { id: 'front-abdomen', departmentId: 'gastroenterology', ko: '복부/위장', en: 'Abdomen', aliases: ['복부', '배/복부', '위장', 'abdomen / gi', 'stomach'] },
  { id: 'front-pelvis', departmentId: 'orthopedics', ko: '골반/하복부', en: 'Pelvis / Lower Abdomen', aliases: ['골반', '하복부', 'pelvis'] },
  { id: 'front-arm-l', departmentId: 'orthopedics', ko: '왼쪽 팔', en: 'Left Arm', aliases: ['팔', 'arm'] },
  { id: 'front-arm-r', departmentId: 'orthopedics', ko: '오른쪽 팔', en: 'Right Arm', aliases: ['arm'] },
  { id: 'front-hand-l', departmentId: 'orthopedics', ko: '왼쪽 손목/손', en: 'Left Wrist / Hand', aliases: ['손', '손목', '손목/손', 'wrist / hand'] },
  { id: 'front-hand-r', departmentId: 'orthopedics', ko: '오른쪽 손목/손', en: 'Right Wrist / Hand', aliases: ['wrist / hand'] },
  { id: 'front-thigh-l', departmentId: 'orthopedics', ko: '왼쪽 허벅지', en: 'Left Thigh', aliases: ['허벅지', 'thigh'] },
  { id: 'front-thigh-r', departmentId: 'orthopedics', ko: '오른쪽 허벅지', en: 'Right Thigh', aliases: ['thigh'] },
  { id: 'front-knee-l', departmentId: 'orthopedics', ko: '왼쪽 무릎', en: 'Left Knee', aliases: ['무릎', '무릎/관절', 'knee / joint', 'knee'] },
  { id: 'front-knee-r', departmentId: 'orthopedics', ko: '오른쪽 무릎', en: 'Right Knee', aliases: ['knee'] },
  { id: 'front-leg-l', departmentId: 'orthopedics', ko: '왼쪽 종아리/발', en: 'Left Calf / Foot', aliases: ['종아리', '발', '발목/발', 'ankle / foot'] },
  { id: 'front-leg-r', departmentId: 'orthopedics', ko: '오른쪽 종아리/발', en: 'Right Calf / Foot', aliases: [] },

  // Back regions
  { id: 'back-head', departmentId: 'neurology', ko: '후두부/머리뒤', en: 'Back of Head', aliases: [] },
  { id: 'back-neck', departmentId: 'orthopedics', ko: '목덜미/경추', en: 'Back of Neck', aliases: ['목(뒤)', '목덜미'] },
  { id: 'back-upper-back', departmentId: 'orthopedics', ko: '등/견갑골', en: 'Upper Back', aliases: ['등', '어깨/등', '견갑골', 'shoulder / back'] },
  { id: 'back-lower-back', departmentId: 'orthopedics', ko: '허리/요통', en: 'Lower Back', aliases: ['허리', '요통', 'lumbar'] },
  { id: 'back-glutes', departmentId: 'orthopedics', ko: '골반/둔부', en: 'Glutes / Pelvis', aliases: ['둔부', '엉덩이'] },
  { id: 'back-arm-l', departmentId: 'orthopedics', ko: '왼쪽 팔(뒤)', en: 'Left Arm (Back)', aliases: [] },
  { id: 'back-arm-r', departmentId: 'orthopedics', ko: '오른쪽 팔(뒤)', en: 'Right Arm (Back)', aliases: [] },
  { id: 'back-hamstring-l', departmentId: 'orthopedics', ko: '왼쪽 햄스트링', en: 'Left Hamstring', aliases: ['햄스트링'] },
  { id: 'back-hamstring-r', departmentId: 'orthopedics', ko: '오른쪽 햄스트링', en: 'Right Hamstring', aliases: [] },
  { id: 'back-calf-l', departmentId: 'orthopedics', ko: '왼쪽 종아리/발목', en: 'Left Calf / Ankle', aliases: ['발목'] },
  { id: 'back-calf-r', departmentId: 'orthopedics', ko: '오른쪽 종아리/발목', en: 'Right Calf / Ankle', aliases: [] },
];

const BODY_PART_BY_ID = new Map<string, BodyPartDefinition>(
  BODY_PART_CATALOG.map((item) => [item.id, item])
);

const BODY_PART_BY_TOKEN = new Map<string, BodyPartDefinition>();
for (const item of BODY_PART_CATALOG) {
  BODY_PART_BY_TOKEN.set(item.id.toLowerCase(), item);
  BODY_PART_BY_TOKEN.set(item.ko.toLowerCase(), item);
  BODY_PART_BY_TOKEN.set(item.en.toLowerCase(), item);
  for (const alias of item.aliases) {
    if (!BODY_PART_BY_TOKEN.has(alias.toLowerCase())) {
      BODY_PART_BY_TOKEN.set(alias.toLowerCase(), item);
    }
  }
}

export function resolveBodyPartId(rawPart?: string | null): string | null {
  const trimmed = (rawPart || '').trim();
  if (!trimmed) return null;
  const hit = BODY_PART_BY_TOKEN.get(trimmed.toLowerCase());
  return hit ? hit.id : null;
}

export function resolveBodyPartIds(raw: string | string[] | null | undefined): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
    ? raw.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const ids: string[] = [];
  for (const item of list) {
    const id = resolveBodyPartId(item);
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}

export function getBodyPartLabel(idOrRaw: string, locale: string = 'ko'): string {
  const trimmed = (idOrRaw || '').trim();
  if (!trimmed) return '';
  const def = BODY_PART_BY_ID.get(trimmed) || BODY_PART_BY_TOKEN.get(trimmed.toLowerCase());
  if (!def) return trimmed;
  return locale.toLowerCase().startsWith('en') ? def.en : def.ko;
}

export function formatBodyPartList(idsOrRaw: string[], locale: string = 'ko'): string {
  return Array.from(
    new Set(idsOrRaw.map((item) => getBodyPartLabel(item, locale)).filter(Boolean))
  ).join(', ');
}

export function classifyBodyPartIdToDepartmentId(partId: string): DepartmentId | null {
  return BODY_PART_BY_ID.get(partId)?.departmentId || null;
}

export type PqrstCategory = 'quality' | 'radiation' | 'triggers' | 'reliefFactors' | 'redFlags';

export interface PqrstCodeDefinition {
  code: string;
  ko: string;
  en: string;
}

export const PQRST_CATALOG: Record<PqrstCategory, readonly PqrstCodeDefinition[]> = {
  quality: [
    { code: 'throbbing', ko: '욱신거림', en: 'Throbbing' },
    { code: 'sharp_stabbing', ko: '찌르는 듯함', en: 'Sharp / Stabbing' },
    { code: 'burning', ko: '타는 듯함', en: 'Burning' },
    { code: 'aching_heavy', ko: '뻐근/묵직함', en: 'Aching / Heavy' },
    { code: 'tight_squeezing', ko: '조이는 느낌', en: 'Tight / Squeezing' },
    { code: 'tingling_electric', ko: '저림/전기', en: 'Tingling / Electric' },
    { code: 'cramping_spasm', ko: '쥐남/경련', en: 'Cramping / Spasm' },
  ],
  radiation: [
    { code: 'to_legs', ko: '하지(다리) 방사', en: 'To Leg(s)' },
    { code: 'to_arms', ko: '상지(팔) 방사', en: 'To Arm(s)' },
    { code: 'to_back_scapula', ko: '등/견갑골 방사', en: 'To Back / Scapula' },
    { code: 'to_pelvis', ko: '골반으로 뻗침', en: 'To Pelvis' },
  ],
  triggers: [
    { code: 'walking', ko: '보행 시', en: 'Walking' },
    { code: 'prolonged_sitting', ko: '오래 앉을 때', en: 'Prolonged Sitting' },
    { code: 'morning_stiffness', ko: '아침 기상 시', en: 'Morning Stiffness' },
    { code: 'cough_sneeze', ko: '기침/재채기', en: 'Cough / Sneeze' },
    { code: 'stress', ko: '스트레스', en: 'Stress' },
    { code: 'cold_weather', ko: '날씨/추위', en: 'Cold / Weather' },
  ],
  reliefFactors: [
    { code: 'lying_rest', ko: '누워서 휴식', en: 'Lying Rest' },
    { code: 'heat_pack', ko: '온찜질', en: 'Heat Pack' },
    { code: 'ice_pack', ko: '냉찜질', en: 'Ice Pack' },
    { code: 'stretching', ko: '스트레칭', en: 'Stretching' },
    { code: 'after_meds', ko: '약 복용 후', en: 'After Meds' },
  ],
  redFlags: [
    { code: 'numbness_sensory_loss', ko: '마비/감각 저하', en: 'Numbness / Sensory Loss' },
    { code: 'limb_weakness', ko: '다리/팔 근력 약화', en: 'Limb Weakness' },
    { code: 'high_fever', ko: '38도 이상 고열 동반', en: 'High Fever (>=38°C)' },
    { code: 'bowel_bladder_loss', ko: '대소변 장애', en: 'Bowel / Bladder Loss' },
  ],
};

const PQRST_TOKEN_MAP: Record<PqrstCategory, Map<string, PqrstCodeDefinition>> = {
  quality: new Map(),
  radiation: new Map(),
  triggers: new Map(),
  reliefFactors: new Map(),
  redFlags: new Map(),
};

(Object.keys(PQRST_CATALOG) as PqrstCategory[]).forEach((cat) => {
  const map = PQRST_TOKEN_MAP[cat];
  for (const item of PQRST_CATALOG[cat]) {
    map.set(item.code.toLowerCase(), item);
    map.set(item.ko.toLowerCase(), item);
    map.set(item.en.toLowerCase(), item);
  }
});

export function resolvePqrstCode(category: PqrstCategory, rawOrCode: string): string {
  const trimmed = (rawOrCode || '').trim();
  if (!trimmed) return '';
  const hit = PQRST_TOKEN_MAP[category].get(trimmed.toLowerCase());
  return hit ? hit.code : trimmed;
}

export function resolvePqrstCodes(category: PqrstCategory, items: string[] = []): string[] {
  const out: string[] = [];
  for (const item of items) {
    const code = resolvePqrstCode(category, item);
    if (code && !out.includes(code)) {
      out.push(code);
    }
  }
  return out;
}

export function getPqrstLabel(
  category: PqrstCategory,
  codeOrRaw: string,
  locale: string = 'ko'
): string {
  const trimmed = (codeOrRaw || '').trim();
  if (!trimmed) return '';
  const hit = PQRST_TOKEN_MAP[category].get(trimmed.toLowerCase());
  if (!hit) return trimmed;
  return locale.toLowerCase().startsWith('en') ? hit.en : hit.ko;
}
