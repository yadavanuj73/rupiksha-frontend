export const stateCodeMap = {
  "ANDHRA PRADESH": "AP",
  "ARUNACHAL PRADESH": "AR",
  ASSAM: "AS",
  BIHAR: "BR",
  CHHATTISGARH: "CG",
  GOA: "GA",
  GUJARAT: "GJ",
  HARYANA: "HR",
  "HIMACHAL PRADESH": "HP",
  JHARKHAND: "JH",
  KARNATAKA: "KA",
  KERALA: "KL",
  "MADHYA PRADESH": "MP",
  MAHARASHTRA: "MH",
  MANIPUR: "MN",
  MEGHALAYA: "ML",
  MIZORAM: "MZ",
  NAGALAND: "NL",
  ODISHA: "OD",
  PUNJAB: "PB",
  RAJASTHAN: "RJ",
  SIKKIM: "SK",
  "TAMIL NADU": "TN",
  TELANGANA: "TS",
  TRIPURA: "TR",
  "UTTAR PRADESH": "UP",
  UTTARAKHAND: "UK",
  "WEST BENGAL": "WB",
  "ANDAMAN AND NICOBAR ISLANDS": "AN",
  CHANDIGARH: "CH",
  "DADRA AND NAGAR HAVELI AND DAMAN AND DIU": "DN",
  DELHI: "DL",
  "JAMMU AND KASHMIR": "JK",
  LADAKH: "LA",
  LAKSHADWEEP: "LD",
  PUDUCHERRY: "PY"
};

const generatedPartyCodes = new Set();

export function getRolePrefix(role) {
  if (!role) return "UNK";
  const r = role.toLowerCase();
  if (r.includes("retailer")) return "RPR";
  if (r.includes("distributor") && !r.includes("super")) return "RPD";
  if (r.includes("super")) return "RPSD";
  return "UNK";
}

export function generatePartyCode(state, role) {
  const normalizedState = (state || "").toString().trim().toUpperCase();
  const stateCode = stateCodeMap[normalizedState] || "XX";
  const prefix = getRolePrefix(role);
  const random = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}${stateCode}${random}`.toUpperCase();
}

export function generateUniquePartyCode(state, role, existingCodes = []) {
  const blocked = new Set(
    [...existingCodes, ...generatedPartyCodes]
      .filter(Boolean)
      .map((code) => code.toString().toUpperCase())
  );

  let candidate = generatePartyCode(state, role);
  while (blocked.has(candidate)) {
    candidate = generatePartyCode(state, role);
  }
  generatedPartyCodes.add(candidate);
  return candidate;
}

