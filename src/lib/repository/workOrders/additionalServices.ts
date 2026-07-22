export const ADDITIONAL_SERVICES_MARKER = "[ADDITIONAL_SERVICES]:";

function stripAdditionalServicesMarker(text: string): string {
  const idx = text.indexOf(ADDITIONAL_SERVICES_MARKER);
  if (idx === -1) return text;
  return text.slice(0, idx).trim();
}

export function encodeAdditionalServicesInNotes(
  issueDescription: string,
  additionalServices: any[]
): string {
  const cleanText = stripAdditionalServicesMarker(String(issueDescription || "")).trim();
  if (!Array.isArray(additionalServices) || additionalServices.length === 0) {
    return cleanText;
  }

  let serialized = "[]";
  try {
    serialized = JSON.stringify(additionalServices);
  } catch {
    serialized = "[]";
  }

  return `${cleanText}\n${ADDITIONAL_SERVICES_MARKER}${serialized}`.trim();
}

export function decodeAdditionalServicesFromNotes(notesRaw: unknown): {
  cleanNotes: string;
  services: any[];
} {
  const notes = String(notesRaw || "");
  const idx = notes.indexOf(ADDITIONAL_SERVICES_MARKER);
  if (idx === -1) {
    return { cleanNotes: notes, services: [] };
  }

  const cleanNotes = notes.slice(0, idx).trim();
  const jsonPart = notes.slice(idx + ADDITIONAL_SERVICES_MARKER.length).trim();

  if (!jsonPart) {
    return { cleanNotes, services: [] };
  }

  try {
    const parsed = JSON.parse(jsonPart);
    return {
      cleanNotes,
      services: Array.isArray(parsed) ? parsed : [],
    };
  } catch {
    return { cleanNotes, services: [] };
  }
}
