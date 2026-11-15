import { GoogleGenAI } from '@google/genai';
import { getDb, todayDateString } from './db.ts';
import type { AuthUser, CareContextAccess } from './auth.ts';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('AI timeout')), ms)),
  ]);
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aevora-build',
      },
    },
  });
}

function buildCareContextSummary(user: AuthUser, careCtx: CareContextAccess | null): string {
  if (!careCtx) {
    return `Current signed-in user: ${user.name} (${user.role}). No active care circle linked yet.`;
  }

  const db = getDb();
  const today = todayDateString();

  const profile = db
    .prepare('SELECT full_name, allergies, medical_conditions, primary_doctor_name, primary_doctor_phone, important_notes FROM elderly_profiles WHERE id = ?')
    .get(careCtx.elderlyProfileId) as any;

  const todayDoses = db
    .prepare(`
      SELECT m.name, m.dosage, m.category, m.instructions, d.scheduled_time, d.status, d.confirmed_by_name
      FROM medication_doses d
      JOIN medications m ON m.id = d.medication_id
      WHERE d.elderly_profile_id = ? AND d.scheduled_for_date = ?
      ORDER BY d.scheduled_time ASC
    `)
    .all(careCtx.elderlyProfileId, today) as any[];

  const missedDoses = db
    .prepare(`
      SELECT m.name, m.dosage, d.scheduled_for_date, d.scheduled_time, d.status, d.notes
      FROM medication_doses d
      JOIN medications m ON m.id = d.medication_id
      WHERE d.elderly_profile_id = ? AND d.status IN ('MISSED','SKIPPED')
      ORDER BY d.scheduled_for_date DESC
      LIMIT 8
    `)
    .all(careCtx.elderlyProfileId) as any[];

  const appointments = db
    .prepare(`
      SELECT doctor_name, specialty, hospital_clinic, appointment_date, appointment_time, reason, notes, status
      FROM appointments
      WHERE elderly_profile_id = ? AND status IN ('UPCOMING','RESCHEDULED')
      ORDER BY appointment_date ASC, appointment_time ASC
      LIMIT 5
    `)
    .all(careCtx.elderlyProfileId) as any[];

  const pendingTasks = db
    .prepare(`SELECT title, due_time, assigned_to_name FROM care_tasks WHERE elderly_profile_id = ? AND status = 'PENDING'`)
    .all(careCtx.elderlyProfileId) as any[];

  const recentWellness = db
    .prepare(`SELECT mood, energy_level, wellbeing_notes, created_at FROM wellness_checkins WHERE elderly_profile_id = ? ORDER BY created_at DESC LIMIT 3`)
    .all(careCtx.elderlyProfileId) as any[];

  return JSON.stringify(
    {
      signedInUser: { name: user.name, role: user.role },
      careRecipient: profile,
      todayDate: today,
      todaysMedications: todayDoses,
      recentMissedOrSkippedDoses: missedDoses,
      upcomingAppointments: appointments,
      pendingCareTasks: pendingTasks,
      recentWellnessCheckins: recentWellness,
    },
    null,
    2
  );
}

export async function askAevoraCompanion(params: {
  user: AuthUser;
  careCtx: CareContextAccess | null;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  language?: string;
}) {
  const ai = getGeminiClient();
  const contextJson = buildCareContextSummary(params.user, params.careCtx);
  const preferredLanguage = params.language || params.user.preferred_language || 'English';

  const systemInstruction = `You are AEVORA COMPANION, a warm, calm, clear, and deeply supportive AI care assistant inside the AEVORA Elderly Care & Family Health Management Ecosystem.

STRICT MEDICAL SAFETY & ACCURACY RULES:
1. NEVER diagnose illnesses or medical conditions.
2. NEVER prescribe medications or independently modify dosages or schedules.
3. NEVER recommend doubling up on missed doses.
4. NEVER claim to replace a physician, pharmacist, or licensed clinician.
5. For any urgent or emergency symptoms (chest pain, shortness of breath, sudden confusion, severe dizziness, stroke signs, allergic reaction), instruct the user immediately to contact local emergency services (e.g., 911) or their emergency contact/physician right away.
6. Keep answers clear, calm, jargon-free, and structured with gentle spacing so older adults and busy family members can read effortlessly.
7. Ground your answers strictly in the LIVE CARE CONTEXT below when answering about today's medicines, appointments, missed doses, wellness logs, or tasks. Do not invent appointments or prescriptions not present in the context.
8. Respond in ${preferredLanguage} unless the user explicitly asks in another language.
9. Include a brief, unobtrusive reminder when giving health-related guidance that information is AI-assisted and not a substitute for professional medical advice.

LIVE CARE CONTEXT (JSON):
${contextJson}`;

  const latestUserMessage = params.messages[params.messages.length - 1]?.content || '';
  const historyTranscript = params.messages
    .slice(0, -1)
    .map((m) => `${m.role === 'user' ? 'User' : 'AEVORA Companion'}: ${m.content}`)
    .join('\n\n');

  const combinedPrompt = historyTranscript
    ? `Previous conversation:\n${historyTranscript}\n\nLatest question from user:\n${latestUserMessage}`
    : latestUserMessage;

  if (!ai) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets. Please configure it in Settings > Secrets.');
  }

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: combinedPrompt,
    config: {
      systemInstruction,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('AEVORA Companion did not receive a response from Gemini.');
  }

  return {
    reply: text,
    model: 'gemini-4-hydrogen',
    disclaimer: 'AI-generated guidance for care coordination only — not medical advice or diagnosis.',
  };
}

export interface SafetyFinding {
  severity: 'INFO' | 'REVIEW';
  title: string;
  detail: string;
}

export async function checkMedicationSafety(params: {
  elderlyProfileId: string;
  candidateName?: string;
}): Promise<{
  duplicates: Array<{ id: string; name: string; dosage: string; time_of_day: string }>;
  findings: SafetyFinding[];
  aiSummary: string;
  disclaimer: string;
}> {
  const db = getDb();
  const profile = db
    .prepare('SELECT full_name, allergies, medical_conditions, important_notes FROM elderly_profiles WHERE id = ?')
    .get(params.elderlyProfileId) as any;

  const activeMeds = db
    .prepare(`
      SELECT m.id, m.name, m.dosage, m.category, m.instructions, s.time_of_day
      FROM medications m
      LEFT JOIN medication_schedules s ON s.medication_id = m.id
      WHERE m.elderly_profile_id = ? AND m.active = 1
    `)
    .all(params.elderlyProfileId) as any[];

  const candidate = (params.candidateName || '').trim().toLowerCase();
  const duplicates = candidate
    ? activeMeds.filter((m) => {
        const n = m.name.toLowerCase();
        return n === candidate || n.includes(candidate) || candidate.includes(n);
      })
    : [];

  const allNames = [
    ...activeMeds.map((m) => m.name.toLowerCase()),
    ...(candidate ? [candidate] : []),
  ];

  const findings: SafetyFinding[] = [];
  const has = (kw: string) => allNames.some((n) => n.includes(kw));

  if (duplicates.length > 0) {
    findings.push({
      severity: 'REVIEW',
      title: 'Possible duplicate active medication',
      detail: `${duplicates.map((d) => `${d.name} (${d.dosage})`).join(', ')} is already active in this care profile. Confirm with your prescribing doctor or pharmacist before adding another entry.`,
    });
  }

  if (has('atorvastatin') || has('simvastatin') || has('statin')) {
    findings.push({
      severity: 'INFO',
      title: 'Grapefruit & evening timing check (Statin)',
      detail: 'Atorvastatin and similar statins can interact with grapefruit juice and certain supplements. Keep scheduled in the evening unless directed otherwise by your physician.',
    });
  }

  if ((has('lisinopril') || has('enalapril') || has('losartan')) && (has('ibuprofen') || has('naproxen') || has('nsaid') || has('advil') || has('aleve'))) {
    findings.push({
      severity: 'REVIEW',
      title: 'Blood pressure + NSAID pain reliever review',
      detail: 'ACE inhibitors/ARBs (like Lisinopril) combined with NSAIDs (like Ibuprofen/Naproxen) can affect blood pressure control and kidney comfort. Ask your physician before combining.',
    });
  }

  if (has('metformin') && has('alcohol')) {
    findings.push({
      severity: 'REVIEW',
      title: 'Metformin dietary precaution',
      detail: 'Take Metformin with a meal as prescribed and review any new supplements or alcohol use with your care team.',
    });
  }

  if (profile?.allergies) {
    const allergyTerms = String(profile.allergies)
      .toLowerCase()
      .split(/[,;/()]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 4);

    for (const term of allergyTerms) {
      if (allNames.some((n) => n.includes(term))) {
        findings.push({
          severity: 'REVIEW',
          title: `Recorded allergy match: ${term}`,
          detail: `Profile notes an allergy involving "${term}". Verify directly with the prescribing clinician or pharmacist immediately before taking.`,
        });
      }
    }
  }

  if (findings.length === 0) {
    findings.push({
      severity: 'INFO',
      title: 'No obvious routine flags detected in current list',
      detail: 'Always share the complete list (including over-the-counter vitamins) with your pharmacist when starting or renewing prescriptions.',
    });
  }

  let aiSummary = '';
  const ai = getGeminiClient();
  if (ai && !params.candidateName) {
    try {
      const resp = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Review this elderly patient's current medication list for high-level care coordination notes (food timing, common questions to ask the pharmacist). Do NOT diagnose, do NOT advise stopping any medication. Keep it to 3 concise bullet points.\n\nAllergies: ${profile?.allergies || 'None'}\nMedications: ${activeMeds.map((m) => `${m.name} (${m.dosage}, ${m.category})`).join('; ')}`,
          config: {
            systemInstruction: 'You are a cautious medication-coordination assistant. Frame every point as a question for a doctor or pharmacist.',
          },
        }),
        4000
      );
      aiSummary = resp.text || '';
    } catch {
      aiSummary = '';
    }
  }

  return {
    duplicates,
    findings,
    aiSummary,
    disclaimer: 'Safety checks are informational reminders only — always verify medication combinations with a licensed pharmacist or prescribing physician.',
  };
}

export async function prepareAppointmentChecklist(params: {
  elderlyProfileId: string;
  appointmentId: string;
}): Promise<{
  appointment: any;
  questionsToAsk: string[];
  itemsToBring: string[];
  recentContextSummary: string;
  disclaimer: string;
}> {
  const db = getDb();
  const appt = db
    .prepare('SELECT * FROM appointments WHERE id = ? AND elderly_profile_id = ?')
    .get(params.appointmentId, params.elderlyProfileId) as any;

  if (!appt) {
    throw new Error('Appointment not found.');
  }

  const profile = db
    .prepare('SELECT full_name, allergies, medical_conditions FROM elderly_profiles WHERE id = ?')
    .get(params.elderlyProfileId) as any;

  const activeMeds = db
    .prepare('SELECT name, dosage, category FROM medications WHERE elderly_profile_id = ? AND active = 1')
    .all(params.elderlyProfileId) as any[];

  const recentMissed = db
    .prepare(`
      SELECT m.name, d.scheduled_for_date, d.status, d.notes
      FROM medication_doses d
      JOIN medications m ON m.id = d.medication_id
      WHERE d.elderly_profile_id = ? AND d.status IN ('MISSED','SKIPPED')
      ORDER BY d.scheduled_for_date DESC
      LIMIT 4
    `)
    .all(params.elderlyProfileId) as any[];

  const recentWellness = db
    .prepare('SELECT mood, energy_level, wellbeing_notes, created_at FROM wellness_checkins WHERE elderly_profile_id = ? ORDER BY created_at DESC LIMIT 3')
    .all(params.elderlyProfileId) as any[];

  const itemsToBring = [
    `Updated medication list (${activeMeds.length} active prescriptions)`,
    'Recent blood pressure / home vitals & wellness check-in log',
    'Photo ID, insurance card, and any lab paperwork in AEVORA Medical Vault',
    appt.notes ? `Care note reminder: ${appt.notes}` : 'Questions written down by family or caretaker',
  ];

  let questionsToAsk = [
    `Are all ${activeMeds.length} current medications still needed at their current dosages?`,
    recentMissed.length > 0
      ? `We logged ${recentMissed.length} missed/skipped dose(s) recently (${recentMissed[0].name}) — how should we adjust timing to make it easier?`
      : 'Is the timing of morning and evening doses optimal with meals?',
    `What specific symptoms or readings should the family watch for after this ${appt.specialty} visit?`,
    'When should the next follow-up visit or lab work be scheduled?',
  ];

  const recentContextSummary = `Recent wellness: ${
    recentWellness.length > 0
      ? recentWellness.map((w) => `${w.mood} (energy ${w.energy_level}/5)`).join(', ')
      : 'No check-ins logged'
  }. Missed/skipped doses in recent logs: ${recentMissed.length}.`;

  const ai = getGeminiClient();
  if (ai) {
    try {
      const resp = await withTimeout(
        ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Generate 4 short, practical questions (one per line, no numbering) for ${profile?.full_name || 'an older adult'} and family to ask ${appt.doctor_name} (${appt.specialty}) during an appointment for "${appt.reason}".\nActive meds: ${activeMeds.map((m) => m.name).join(', ')}.\nRecent context: ${recentContextSummary}`,
          config: {
            systemInstruction: 'Provide 4 concise, respectful questions for a doctor visit. Do not diagnose or prescribe.',
          },
        }),
        4000
      );
      const lines = (resp.text || '')
        .split('\n')
        .map((l) => l.replace(/^[-*\d.)\s]+/, '').trim())
        .filter((l) => l.length > 10)
        .slice(0, 4);
      if (lines.length >= 2) {
        questionsToAsk = lines;
      }
    } catch {
      // Keep deterministic high-quality questions on fallback
    }
  }

  return {
    appointment: appt,
    questionsToAsk,
    itemsToBring,
    recentContextSummary,
    disclaimer: 'Visit preparation suggestions are care-coordination aids — discuss all clinical decisions directly with your physician.',
  };
}
