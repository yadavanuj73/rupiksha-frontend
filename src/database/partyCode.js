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

export function resolveStateCode(state) {
  if (!state) return "BR";
  const upper = String(state).trim().toUpperCase();

  if (upper.length === 2 && /^[A-Z]{2}$/.test(upper)) {
    return upper;
  }

  if (stateCodeMap[upper]) return stateCodeMap[upper];

  if (upper.includes("BIHAR") || upper.includes("MUZAFFARPUR") || upper.includes("PATNA") || upper.includes("NALANDA")) return "BR";
  if (upper.includes("MAHARASHTRA") || upper.includes("MUMBAI") || upper.includes("PUNE")) return "MH";
  if (upper.includes("UTTAR PRADESH") || upper.includes("LUCKNOW") || upper.includes("KANPUR") || upper.includes("NOIDA")) return "UP";
  if (upper.includes("DELHI") || upper.includes("NEW DELHI")) return "DL";
  if (upper.includes("WEST BENGAL") || upper.includes("BENGAL") || upper.includes("KOLKATA")) return "WB";
  if (upper.includes("RAJASTHAN") || upper.includes("JAIPUR")) return "RJ";
  if (upper.includes("PUNJAB") || upper.includes("LUDHIANA")) return "PB";
  if (upper.includes("HARYANA") || upper.includes("GURGAON") || upper.includes("GURUGRAM")) return "HR";
  if (upper.includes("GUJARAT") || upper.includes("SURAT") || upper.includes("AHMEDABAD")) return "GJ";
  if (upper.includes("KARNATAKA") || upper.includes("BANGALORE") || upper.includes("BENGALURU")) return "KA";
  if (upper.includes("TAMIL NADU") || upper.includes("CHENNAI")) return "TN";
  if (upper.includes("TELANGANA") || upper.includes("HYDERABAD")) return "TS";
  if (upper.includes("ANDHRA")) return "AP";
  if (upper.includes("MADHYA PRADESH") || upper.includes("INDORE") || upper.includes("BHOPAL")) return "MP";
  if (upper.includes("ODISHA") || upper.includes("ORISSA")) return "OD";
  if (upper.includes("JHARKHAND") || upper.includes("RANCHI")) return "JH";
  if (upper.includes("CHHATTISGARH") || upper.includes("RAIPUR")) return "CG";

  return "BR";
}

export function getRolePrefix(role) {
  if (!role) return "RPR";
  const r = String(role).trim().toLowerCase();
  if (r.includes("super")) return "RPSD";
  if (r.includes("distributor")) return "RPD";
  if (r.includes("admin") || r.includes("header") || r.includes("employee")) return "RPADM";
  return "RPR";
}

export function generatePartyCode(state, role) {
  const stateCode = resolveStateCode(state);
  const prefix = getRolePrefix(role);
  const random5Digits = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}${stateCode}${random5Digits}`.toUpperCase();
}

export function generateUniquePartyCode(state, role, existingCodes = []) {
  const blocked = new Set(
    [...existingCodes, ...generatedPartyCodes]
      .filter(Boolean)
      .map((code) => code.toString().toUpperCase())
  );

  let candidate = generatePartyCode(state, role);
  let attempts = 0;
  while (blocked.has(candidate) && attempts < 100) {
    candidate = generatePartyCode(state, role);
    attempts++;
  }
  generatedPartyCodes.add(candidate);
  return candidate;
}

