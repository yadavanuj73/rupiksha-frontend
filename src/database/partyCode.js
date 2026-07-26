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

  // 28 States & 8 UTs mapping
  if (upper.includes("BIHAR") || upper.includes("MUZAFFARPUR") || upper.includes("PATNA") || upper.includes("NALANDA") || upper.includes("GAYA") || upper.includes("BHAGALPUR") || upper.includes("DARBHANGA") || upper.includes("PURNEA")) return "BR";
  if (upper.includes("MAHARASHTRA") || upper.includes("MUMBAI") || upper.includes("PUNE") || upper.includes("NAGPUR") || upper.includes("THANE") || upper.includes("NASHIK")) return "MH";
  if (upper.includes("UTTAR PRADESH") || upper.includes("LUCKNOW") || upper.includes("KANPUR") || upper.includes("NOIDA") || upper.includes("VARANASI") || upper.includes("AGRA") || upper.includes("PRAYAGRAJ") || upper.includes("GHAZIABAD")) return "UP";
  if (upper.includes("DELHI") || upper.includes("NEW DELHI") || upper.includes("NCT")) return "DL";
  if (upper.includes("WEST BENGAL") || upper.includes("BENGAL") || upper.includes("KOLKATA") || upper.includes("HOWRAH") || upper.includes("SILIGURI")) return "WB";
  if (upper.includes("RAJASTHAN") || upper.includes("JAIPUR") || upper.includes("JODHPUR") || upper.includes("UDAIPUR") || upper.includes("KOTA")) return "RJ";
  if (upper.includes("PUNJAB") || upper.includes("LUDHIANA") || upper.includes("AMRITSAR") || upper.includes("JALANDHAR")) return "PB";
  if (upper.includes("HARYANA") || upper.includes("GURGAON") || upper.includes("GURUGRAM") || upper.includes("FARIDABAD") || upper.includes("PANIPAT")) return "HR";
  if (upper.includes("GUJARAT") || upper.includes("SURAT") || upper.includes("AHMEDABAD") || upper.includes("VADODARA") || upper.includes("RAJKOT")) return "GJ";
  if (upper.includes("KARNATAKA") || upper.includes("BANGALORE") || upper.includes("BENGALURU") || upper.includes("MYSORE") || upper.includes("MYSURU")) return "KA";
  if (upper.includes("TAMIL NADU") || upper.includes("CHENNAI") || upper.includes("COIMBATORE") || upper.includes("MADURAI")) return "TN";
  if (upper.includes("TELANGANA") || upper.includes("HYDERABAD") || upper.includes("WARANGAL")) return "TS";
  if (upper.includes("ANDHRA") || upper.includes("VISAKHAPATNAM") || upper.includes("VIJAYAWADA")) return "AP";
  if (upper.includes("MADHYA PRADESH") || upper.includes("INDORE") || upper.includes("BHOPAL") || upper.includes("GWALIOR") || upper.includes("JABALPUR")) return "MP";
  if (upper.includes("ODISHA") || upper.includes("ORISSA") || upper.includes("BHUBANESWAR") || upper.includes("CUTTACK")) return "OD";
  if (upper.includes("JHARKHAND") || upper.includes("RANCHI") || upper.includes("JAMSHEDPUR") || upper.includes("DHANBAD")) return "JH";
  if (upper.includes("CHHATTISGARH") || upper.includes("RAIPUR") || upper.includes("BILASPUR")) return "CG";
  if (upper.includes("ASSAM") || upper.includes("GUWAHATI") || upper.includes("DISPUR")) return "AS";
  if (upper.includes("KERALA") || upper.includes("KOCHI") || upper.includes("THIRUVANANTHAPURAM") || upper.includes("TRIVANDRUM")) return "KL";
  if (upper.includes("UTTARAKHAND") || upper.includes("UTTARANCHAL") || upper.includes("DEHRADUN") || upper.includes("HARIDWAR")) return "UK";
  if (upper.includes("HIMACHAL") || upper.includes("SHIMLA")) return "HP";
  if (upper.includes("JAMMU") || upper.includes("KASHMIR") || upper.includes("SRINAGAR")) return "JK";
  if (upper.includes("GOA") || upper.includes("PANAJI")) return "GA";
  if (upper.includes("MANIPUR") || upper.includes("IMPHAL")) return "MN";
  if (upper.includes("MEGHALAYA") || upper.includes("SHILLONG")) return "ML";
  if (upper.includes("MIZORAM") || upper.includes("AIZAWL")) return "MZ";
  if (upper.includes("NAGALAND") || upper.includes("KOHIMA")) return "NL";
  if (upper.includes("SIKKIM") || upper.includes("GANGTOK")) return "SK";
  if (upper.includes("TRIPURA") || upper.includes("AGARTALA")) return "TR";
  if (upper.includes("ARUNACHAL") || upper.includes("ITANAGAR")) return "AR";
  if (upper.includes("PUDUCHERRY") || upper.includes("PONDICHERRY")) return "PY";
  if (upper.includes("CHANDIGARH")) return "CH";
  if (upper.includes("LADAKH") || upper.includes("LEH")) return "LA";
  if (upper.includes("ANDAMAN") || upper.includes("NICOBAR") || upper.includes("PORT BLAIR")) return "AN";
  if (upper.includes("DADRA") || upper.includes("DAMAN") || upper.includes("DIU")) return "DN";
  if (upper.includes("LAKSHADWEEP") || upper.includes("KAVARATTI")) return "LD";

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

