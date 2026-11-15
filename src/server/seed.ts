import { getDb, generateId, hashPassword, offsetDateString, todayDateString } from './db.ts';

export function ensureSeedData() {
  const db = getDb();
  const existing = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (existing.count > 0) return;

  console.log('Seeding AEVORA demo ecosystem...');

  const eleanorId = 'usr_eleanor';
  const mayaId = 'usr_maya';
  const davidId = 'usr_david';
  const adminId = 'usr_admin';
  const profileId = 'prof_eleanor';
  const circleId = 'circ_vance';

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, status, avatar_url, phone, preferred_language, accessible_mode, onboarding_completed)
    VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, 'English', ?, 1)
  `);

  insertUser.run(
    eleanorId,
    'eleanor@aevora.care',
    hashPassword('CareCircle2026!'),
    'Eleanor Vance',
    'ELDERLY',
    '/src/assets/images/avatar_elderly_eleanor_1794727370012.jpg',
    '+1 (415) 555-0142',
    0
  );
  insertUser.run(
    mayaId,
    'maya@aevora.care',
    hashPassword('CareCircle2026!'),
    'Maya Vance',
    'FAMILY',
    '/src/assets/images/avatar_family_maya_1794727370428.jpg',
    '+1 (415) 555-0188',
    0
  );
  insertUser.run(
    davidId,
    'david@aevora.care',
    hashPassword('CareCircle2026!'),
    'David Okafor',
    'CARETAKER',
    '',
    '+1 (415) 555-0194',
    0
  );
  insertUser.run(
    adminId,
    'admin@aevora.care',
    hashPassword('AdminCare2026!'),
    'Claire Bennett',
    'ADMIN',
    '',
    '+1 (415) 555-0100',
    0
  );

  // Notification preferences
  const insertPref = db.prepare(`
    INSERT INTO notification_preferences (id, user_id, email_enabled, reminder_lead_minutes, escalation_grace_minutes, escalate_to_caretaker, escalate_to_family, refill_lead_days, timezone)
    VALUES (?, ?, 1, 30, 45, 1, 1, 5, 'America/Los_Angeles')
  `);
  insertPref.run(generateId('pref'), eleanorId);
  insertPref.run(generateId('pref'), mayaId);
  insertPref.run(generateId('pref'), davidId);
  insertPref.run(generateId('pref'), adminId);

  // Elderly Profile
  db.prepare(`
    INSERT INTO elderly_profiles (
      id, user_id, full_name, date_of_birth, blood_type, allergies, medical_conditions,
      primary_doctor_name, primary_doctor_phone, primary_doctor_clinic, important_notes,
      preferred_language, accessibility_large_text, accessibility_high_contrast, accessibility_simplified,
      care_pin_hash, onboarding_completed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'English', 0, 0, 0, ?, 1)
  `).run(
    profileId,
    eleanorId,
    'Eleanor Vance',
    '1952-04-18',
    'A+',
    'Penicillin (hives), Sulfa drugs',
    'Mild Essential Hypertension, Type 2 Diabetes (diet & metformin managed), Osteopenia',
    'Dr. Priya Nair, MD',
    '+1 (415) 890-3320',
    'Pacific Heights Internal Medicine',
    'Prefers morning medications with warm oatmeal. Avoid NSAIDs; use acetaminophen if approved by Dr. Nair.',
    hashPassword('4829')
  );

  // Care Circle
  db.prepare(`INSERT INTO care_circles (id, elderly_profile_id, name) VALUES (?, ?, ?)`).run(
    circleId,
    profileId,
    'Vance Family Care Circle'
  );

  // Members + Permissions
  const insertMember = db.prepare(`
    INSERT INTO care_circle_members (id, care_circle_id, user_id, member_role, relationship, responsibilities, status)
    VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
  `);
  const insertPerm = db.prepare(`
    INSERT INTO access_permissions (
      id, care_circle_member_id, can_view_medications, can_manage_medications, can_confirm_doses,
      can_view_appointments, can_manage_appointments, can_view_medical_vault, can_edit_health_profile, can_receive_escalations
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const memEleanor = 'mem_eleanor';
  const memMaya = 'mem_maya';
  const memDavid = 'mem_david';

  insertMember.run(memEleanor, circleId, eleanorId, 'ELDERLY', 'Self', 'Primary care owner');
  insertPerm.run(generateId('perm'), memEleanor, 1, 1, 1, 1, 1, 1, 1, 1);

  insertMember.run(memMaya, circleId, mayaId, 'FAMILY', 'Daughter', 'Coordinates cardiology appointments, refills, and evening check-ins');
  insertPerm.run(generateId('perm'), memMaya, 1, 1, 1, 1, 1, 1, 1, 1);

  insertMember.run(memDavid, circleId, davidId, 'CARETAKER', 'Home Care Specialist', 'Morning & afternoon routine support, blood pressure checks, shift handovers');
  insertPerm.run(generateId('perm'), memDavid, 1, 0, 1, 1, 0, 0, 0, 1);

  // Pending invitation demo
  db.prepare(`
    INSERT INTO invitations (id, care_circle_id, invited_by_user_id, email, target_role, relationship, code, status, permissions_json, expires_at)
    VALUES (?, ?, ?, ?, 'FAMILY', 'Son', 'AEV-849210', 'PENDING', ?, datetime('now', '+14 days'))
  `).run(
    generateId('inv'),
    circleId,
    eleanorId,
    'marcus.vance@example.com',
    JSON.stringify({ canViewMedications: true, canConfirmDoses: true, canViewAppointments: true, canReceiveEscalations: true })
  );

  // Medications + Schedules
  const meds = [
    {
      id: 'med_lisinopril',
      name: 'Lisinopril',
      dosage: '10 mg',
      frequency: 'Once daily',
      category: 'MORNING',
      instructions: 'Take 1 tablet with a full glass of water before breakfast.',
      doctor: 'Dr. Priya Nair, MD',
      startDate: offsetDateString(-90),
      endDate: null,
      refillDate: offsetDateString(4),
      units: 12,
      time: '08:00',
    },
    {
      id: 'med_metformin',
      name: 'Metformin ER',
      dosage: '500 mg',
      frequency: 'Twice daily',
      category: 'AFTERNOON',
      instructions: 'Take with lunch to reduce stomach sensitivity.',
      doctor: 'Dr. Priya Nair, MD',
      startDate: offsetDateString(-120),
      endDate: null,
      refillDate: offsetDateString(14),
      units: 28,
      time: '13:00',
    },
    {
      id: 'med_vitd',
      name: 'Vitamin D3 + Calcium',
      dosage: '2000 IU',
      frequency: 'Once daily',
      category: 'EVENING',
      instructions: 'Take with dinner for optimal absorption.',
      doctor: 'Dr. Hannah Cho, MD',
      startDate: offsetDateString(-60),
      endDate: null,
      refillDate: offsetDateString(22),
      units: 44,
      time: '18:30',
    },
    {
      id: 'med_atorvastatin',
      name: 'Atorvastatin',
      dosage: '20 mg',
      frequency: 'Once nightly',
      category: 'NIGHT',
      instructions: 'Take 1 tablet at bedtime. Avoid grapefruit juice.',
      doctor: 'Dr. Julian Morales, MD',
      startDate: offsetDateString(-180),
      endDate: null,
      refillDate: offsetDateString(9),
      units: 18,
      time: '21:30',
    },
  ];

  const insertMed = db.prepare(`
    INSERT INTO medications (id, elderly_profile_id, name, dosage, frequency, category, instructions, prescribing_doctor, start_date, end_date, refill_date, remaining_units, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);
  const insertSched = db.prepare(`
    INSERT INTO medication_schedules (id, medication_id, time_of_day, days_of_week, timezone)
    VALUES (?, ?, ?, 'DAILY', 'America/Los_Angeles')
  `);
  const insertDose = db.prepare(`
    INSERT INTO medication_doses (id, medication_id, schedule_id, elderly_profile_id, scheduled_for_date, scheduled_time, status, confirmed_by_user_id, confirmed_by_name, confirmed_at, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertLog = db.prepare(`
    INSERT INTO medication_logs (id, dose_id, medication_id, elderly_profile_id, action, previous_status, new_status, actor_user_id, actor_name, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const m of meds) {
    insertMed.run(
      m.id,
      profileId,
      m.name,
      m.dosage,
      m.frequency,
      m.category,
      m.instructions,
      m.doctor,
      m.startDate,
      m.endDate,
      m.refillDate,
      m.units
    );
    const schedId = `sch_${m.id}`;
    insertSched.run(schedId, m.id, m.time);

    // 14 days of historical doses for genuine Recharts analytics
    for (let d = -13; d <= 0; d++) {
      const dateStr = offsetDateString(d);
      let status = 'TAKEN';
      let confirmedBy: string | null = eleanorId;
      let confirmedName: string | null = 'Eleanor Vance';
      let confirmedAt: string | null = `${dateStr}T${m.time}:00`;
      let note = '';

      if (d === 0) {
        // Today's doses: Morning is taken, Afternoon/Evening/Night are scheduled (realistic active day)
        if (m.category === 'MORNING') {
          status = 'TAKEN';
          confirmedBy = eleanorId;
          confirmedName = 'Eleanor Vance';
          confirmedAt = `${dateStr}T08:08:00`;
          note = 'Taken with warm oatmeal';
        } else {
          status = 'SCHEDULED';
          confirmedBy = null;
          confirmedName = null;
          confirmedAt = null;
        }
      } else if (d === -2 && m.id === 'med_atorvastatin') {
        status = 'MISSED';
        confirmedBy = null;
        confirmedName = null;
        confirmedAt = null;
        note = 'Fell asleep early; escalated to Maya Vance';
      } else if (d === -5 && m.id === 'med_metformin') {
        status = 'SKIPPED';
        confirmedBy = davidId;
        confirmedName = 'David Okafor';
        confirmedAt = `${dateStr}T13:20:00`;
        note = 'Skipped per mild nausea before lunch; Dr. Nair notified';
      } else if (d === -8 && m.id === 'med_vitd') {
        status = 'TAKEN';
        confirmedBy = mayaId;
        confirmedName = 'Maya Vance';
        confirmedAt = `${dateStr}T18:55:00`;
      } else if (d === -10 && m.id === 'med_lisinopril') {
        status = 'TAKEN';
        confirmedBy = davidId;
        confirmedName = 'David Okafor';
        confirmedAt = `${dateStr}T08:15:00`;
      }

      const doseId = `dose_${m.id}_${dateStr}`;
      insertDose.run(
        doseId,
        m.id,
        schedId,
        profileId,
        dateStr,
        m.time,
        status,
        confirmedBy,
        confirmedName,
        confirmedAt,
        note
      );

      if (status !== 'SCHEDULED') {
        insertLog.run(
          generateId('log'),
          doseId,
          m.id,
          profileId,
          status === 'TAKEN' ? 'DOSE_CONFIRMED' : `DOSE_${status}`,
          'SCHEDULED',
          status,
          confirmedBy ?? 'system',
          confirmedName ?? 'AEVORA Scheduler',
          note || `${m.name} (${m.dosage}) marked as ${status.toLowerCase()}`,
          confirmedAt ?? `${dateStr}T23:00:00`
        );
      }
    }
  }

  // Appointments
  const insertAppt = db.prepare(`
    INSERT INTO appointments (id, elderly_profile_id, doctor_name, specialty, hospital_clinic, appointment_date, appointment_time, address, contact_number, reason, notes, status, follow_up_date, reminder_sent, created_by_user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAppt.run(
    'appt_cardiology',
    profileId,
    'Dr. Julian Morales, MD',
    'Cardiology',
    'UCSF Medical Center — Heart & Vascular',
    offsetDateString(1),
    '10:30',
    '400 Parnassus Ave, Suite 500, San Francisco, CA',
    '+1 (415) 353-2873',
    'Quarterly blood pressure & lipid panel review',
    'Bring home blood pressure log from the last 14 days. Maya driving.',
    'UPCOMING',
    null,
    0,
    mayaId
  );
  insertAppt.run(
    'appt_ophthalmology',
    profileId,
    'Dr. Marcus Lin, OD',
    'Ophthalmology',
    'Bay Area Retinal Associates',
    offsetDateString(6),
    '14:00',
    '2100 Webster St, Suite 214, San Francisco, CA',
    '+1 (415) 923-3937',
    'Annual diabetic retinal screening',
    'Eyes may be dilated; arrange ride home with David.',
    'UPCOMING',
    null,
    0,
    eleanorId
  );
  insertAppt.run(
    'appt_primary',
    profileId,
    'Dr. Priya Nair, MD',
    'Internal Medicine',
    'Pacific Heights Internal Medicine',
    offsetDateString(-11),
    '09:15',
    '2340 Clay St, Floor 3, San Francisco, CA',
    '+1 (415) 890-3320',
    'A1C check & medication review',
    'A1C improved to 6.6%. Continue Metformin ER 500mg.',
    'COMPLETED',
    offsetDateString(79),
    1,
    mayaId
  );

  // Care Notes
  const insertNote = db.prepare(`
    INSERT INTO care_notes (id, elderly_profile_id, author_user_id, author_name, author_role, category, title, content, is_pinned)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertNote.run(
    generateId('note'),
    profileId,
    davidId,
    'David Okafor',
    'CARETAKER',
    'Vitals',
    'Morning Blood Pressure & Hydration Check',
    'BP 124/76 mmHg sitting after 5 minutes rest. Pulse 70 bpm. Appetite good — finished oatmeal and herbal tea.',
    1
  );
  insertNote.run(
    generateId('note'),
    profileId,
    mayaId,
    'Maya Vance',
    'FAMILY',
    'Logistics',
    'Lisinopril Refill Ready at Walgreens Divisadero',
    'Pharmacy confirmed 90-day refill is queued for pickup tomorrow after cardiology visit.',
    0
  );

  // Care Tasks
  const insertTask = db.prepare(`
    INSERT INTO care_tasks (id, elderly_profile_id, assigned_to_user_id, assigned_to_name, created_by_user_id, title, description, due_time, status, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertTask.run(
    generateId('task'),
    profileId,
    davidId,
    'David Okafor',
    mayaId,
    'Record afternoon blood pressure before Metformin',
    'Use upper-arm cuff on left arm and log reading in care notes.',
    '12:45',
    'PENDING',
    null
  );
  insertTask.run(
    generateId('task'),
    profileId,
    mayaId,
    'Maya Vance',
    eleanorId,
    'Confirm transportation for Cardiology follow-up',
    'Verify parking pass and bring printed lab report.',
    '18:00',
    'PENDING',
    null
  );
  insertTask.run(
    generateId('task'),
    profileId,
    davidId,
    'David Okafor',
    davidId,
    '20-minute garden walk & hydration check',
    'Completed sunny morning walk around courtyard.',
    '09:30',
    'COMPLETED',
    `${todayDateString()}T09:50:00`
  );

  // Care Handover
  db.prepare(`
    INSERT INTO care_handovers (id, elderly_profile_id, from_user_id, from_name, shift_label, completed_activities, pending_tasks, observations, next_shift_instructions, acknowledged_by_name, acknowledged_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    generateId('hand'),
    profileId,
    davidId,
    'David Okafor',
    'Morning Shift (07:30 – 13:30)',
    'Assisted with 08:00 Lisinopril dose, prepared breakfast, completed 20-min garden walk, checked BP (124/76).',
    'Metformin ER 500mg due at 13:00 with lunch; confirm afternoon hydration target (3 glasses water).',
    'Eleanor is in cheerful spirits, slept 7.5 hours, no dizziness upon standing.',
    'Please remind Eleanor to place her cardiology folder by the front hallway table before evening.',
    'Maya Vance',
    `${todayDateString()}T10:15:00`
  );

  // Emergency Contacts
  const insertEmerg = db.prepare(`
    INSERT INTO emergency_contacts (id, elderly_profile_id, name, relationship, phone, email, is_primary, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertEmerg.run(
    generateId('emc'),
    profileId,
    'Maya Vance',
    'Daughter (Primary Health Proxy)',
    '+1 (415) 555-0188',
    'maya@aevora.care',
    1,
    'Lives 12 minutes away in Laurel Heights. Has spare house keys.'
  );
  insertEmerg.run(
    generateId('emc'),
    profileId,
    'David Okafor',
    'Home Care Specialist',
    '+1 (415) 555-0194',
    'david@aevora.care',
    0,
    'On duty Mon–Fri 07:30–15:30.'
  );

  // Medical Vault Records
  const insertRec = db.prepare(`
    INSERT INTO medical_records (id, elderly_profile_id, title, record_type, file_name, mime_type, file_size, content_summary, restricted_to_owner, uploaded_by_user_id, uploaded_by_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertRec.run(
    generateId('rec'),
    profileId,
    'Comprehensive Metabolic & Lipid Panel',
    'LAB_RESULT',
    'ucsf_lipid_a1c_report.pdf',
    'application/pdf',
    248120,
    'A1C 6.6% (improved from 7.0%), LDL 84 mg/dL, eGFR > 75. Reviewed by Dr. Nair.',
    0,
    mayaId,
    'Maya Vance'
  );
  insertRec.run(
    generateId('rec'),
    profileId,
    'Cardiology Medication Authorization',
    'PRESCRIPTION',
    'lisinopril_atorvastatin_rx.pdf',
    'application/pdf',
    112400,
    'Active 90-day prescriptions for Lisinopril 10mg & Atorvastatin 20mg.',
    0,
    eleanorId,
    'Eleanor Vance'
  );
  insertRec.run(
    generateId('rec'),
    profileId,
    'Advance Healthcare Directive (Owner & Proxy Only)',
    'MEDICAL_REPORT',
    'vance_advance_directive.pdf',
    'application/pdf',
    418900,
    'Sensitive legal healthcare proxy document restricted to Eleanor and designated family.',
    1,
    eleanorId,
    'Eleanor Vance'
  );

  // Notifications + Email Logs
  const notif1 = generateId('ntf');
  const notif2 = generateId('ntf');
  db.prepare(`
    INSERT INTO notifications (id, user_id, elderly_profile_id, type, title, message, status, channel, related_entity_key)
    VALUES (?, ?, ?, 'APPOINTMENT_REMINDER', 'Cardiology Follow-up Tomorrow at 10:30 AM', 'Dr. Julian Morales at UCSF Medical Center. Remember to bring the 14-day blood pressure log.', 'UNREAD', 'EMAIL', ?)
  `).run(notif1, mayaId, profileId, 'seed_appt_cardiology');

  db.prepare(`
    INSERT INTO notifications (id, user_id, elderly_profile_id, type, title, message, status, channel, related_entity_key)
    VALUES (?, ?, ?, 'REFILL_REMINDER', 'Lisinopril 10mg Refill Due in 4 Days', '12 tablets remaining. Refill scheduled at Walgreens Divisadero.', 'UNREAD', 'IN_APP', ?)
  `).run(notif2, eleanorId, profileId, 'seed_refill_lisinopril');

  db.prepare(`
    INSERT INTO email_logs (id, notification_id, recipient_email, subject, html_preview, status, provider_id, retry_count)
    VALUES (?, ?, 'maya@aevora.care', 'AEVORA Care Alert: Cardiology Follow-up Tomorrow at 10:30 AM', ?, 'SENT', 'sim_res_8812a', 0)
  `).run(
    generateId('eml'),
    notif1,
    '<div style="font-family:sans-serif"><h2>AEVORA Care Reminder</h2><p>Cardiology appointment with Dr. Julian Morales is tomorrow at 10:30 AM.</p></div>'
  );

  // Audit logs & Reported issues
  db.prepare(`
    INSERT INTO audit_logs (id, actor_user_id, actor_email, actor_role, action, resource_type, resource_id, details)
    VALUES
      (?, ?, 'eleanor@aevora.care', 'ELDERLY', 'DOSE_CONFIRMED', 'MedicationDose', 'dose_med_lisinopril_today', 'Confirmed morning Lisinopril 10mg'),
      (?, ?, 'maya@aevora.care', 'FAMILY', 'APPOINTMENT_CREATED', 'Appointment', 'appt_cardiology', 'Scheduled Dr. Julian Morales follow-up'),
      (?, ?, 'david@aevora.care', 'CARETAKER', 'HANDOVER_SUBMITTED', 'CareHandover', 'handover_morning', 'Completed morning shift handover notes')
  `).run(generateId('aud'), eleanorId, generateId('aud'), mayaId, generateId('aud'), davidId);

  db.prepare(`
    INSERT INTO reported_issues (id, reporter_user_id, reporter_email, subject, description, severity, status)
    VALUES (?, ?, 'maya@aevora.care', 'Pharmacy refill SMS confirmation delay', 'Refill alert arrived in email on time, requesting optional SMS preview in future release.', 'LOW', 'OPEN')
  `).run(generateId('iss'), mayaId);

  ensureExpandedDemoRecords();
  console.log('AEVORA demo seed completed.');
}

export function ensureExpandedDemoRecords() {
  const db = getDb();
  const profileExists = db.prepare(`SELECT id FROM elderly_profiles WHERE id = 'prof_eleanor'`).get();
  if (!profileExists) return;

  const wellnessCount = (db.prepare(`SELECT COUNT(*) as c FROM wellness_checkins WHERE elderly_profile_id = 'prof_eleanor'`).get() as any).c;
  if (wellnessCount === 0) {
    const insertWellness = db.prepare(`
      INSERT INTO wellness_checkins (id, elderly_profile_id, author_user_id, author_name, mood, energy_level, wellbeing_notes, created_at)
      VALUES (?, 'prof_eleanor', ?, ?, ?, ?, ?, ?)
    `);
    insertWellness.run(
      generateId('wel'),
      'usr_eleanor',
      'Eleanor Vance',
      'GOOD',
      4,
      'Slept peacefully for 7.5 hours. Enjoyed morning oatmeal and garden walk.',
      `${todayDateString()}T08:30:00`
    );
    insertWellness.run(
      generateId('wel'),
      'usr_eleanor',
      'Eleanor Vance',
      'GREAT',
      5,
      'Feeling energetic after video call with Maya and grandchildren.',
      `${offsetDateString(-1)}T09:15:00`
    );
    insertWellness.run(
      generateId('wel'),
      'usr_david',
      'David Okafor',
      'TIRED',
      3,
      'Slightly fatigued in the afternoon; rested for 40 minutes and hydrated well.',
      `${offsetDateString(-2)}T15:20:00`
    );
  }
}

// Allow running via `npm run seed`
if (import.meta.url === `file://${process.argv[1]}`) {
  ensureSeedData();
  ensureExpandedDemoRecords();
}
