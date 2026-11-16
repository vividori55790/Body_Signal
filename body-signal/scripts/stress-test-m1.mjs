import assert from 'node:assert/strict';
import {
  PainLogSchema,
  ConditionSchema,
  HealthDataPayloadSchema,
} from '../src/types/health.ts';

console.log('======================================================================');
console.log('       Milestone 1 Empirical Stress Test & Adversarial Suite          ');
console.log('======================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const findings = [];

function testCase(id, description, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ [${id}] ${description}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ [${id}] ${description}`);
    console.error(`      Failure: ${err.message}`);
    findings.push({ id, description, error: err.message });
  }
}

// ----------------------------------------------------------------------------
// Group 1: Intensity Fuzzing & Boundary Testing (0, -1, 11, 999, non-numeric, array)
// ----------------------------------------------------------------------------
console.log('▶ Group 1: Intensity Fuzzing on PainLogSchema & HealthDataPayloadSchema');

testCase('ADV-1.1', 'PainLogSchema rejects intensity = 0 (boundary below min 1)', () => {
  const result = PainLogSchema.safeParse({
    id: 'l-0',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: 0,
  });
  assert.equal(result.success, false, 'intensity 0 should be rejected');
});

testCase('ADV-1.2', 'PainLogSchema rejects intensity = -1 (negative integer)', () => {
  const result = PainLogSchema.safeParse({
    id: 'l-neg',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: -1,
  });
  assert.equal(result.success, false, 'intensity -1 should be rejected');
});

testCase('ADV-1.3', 'PainLogSchema rejects intensity = 11 (boundary above max 10)', () => {
  const result = PainLogSchema.safeParse({
    id: 'l-11',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: 11,
  });
  assert.equal(result.success, false, 'intensity 11 should be rejected');
});

testCase('ADV-1.4', 'PainLogSchema rejects intensity = 999 (large positive integer)', () => {
  const result = PainLogSchema.safeParse({
    id: 'l-999',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: 999,
  });
  assert.equal(result.success, false, 'intensity 999 should be rejected');
});

testCase('ADV-1.5', 'PainLogSchema rejects non-numeric string as intensity ("five")', () => {
  const result = PainLogSchema.safeParse({
    id: 'l-str',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: 'five',
  });
  assert.equal(result.success, false, 'string "five" should be rejected');
});

testCase('ADV-1.6', 'PainLogSchema rejects array of strings as intensity (["7"])', () => {
  const result = PainLogSchema.safeParse({
    id: 'l-arr',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: ['7'],
  });
  assert.equal(result.success, false, 'array ["7"] should be rejected');
});

testCase('ADV-1.7', 'PainLogSchema rejects float intensity = 5.5 (only integers 1-10 allowed)', () => {
  const result = PainLogSchema.safeParse({
    id: 'l-float',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: 5.5,
  });
  assert.equal(result.success, false, 'float 5.5 should be rejected');
});

testCase('ADV-1.8', 'PainLogSchema accepts valid boundary values 1 and 10', () => {
  const r1 = PainLogSchema.safeParse({
    id: 'l-1',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: 1,
  });
  const r10 = PainLogSchema.safeParse({
    id: 'l-10',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: 10,
  });
  assert.equal(r1.success, true, 'intensity 1 should be accepted');
  assert.equal(r10.success, true, 'intensity 10 should be accepted');
});

testCase('ADV-1.9', 'postMedIntensity allows 0 (complete relief) up to 10', () => {
  const r0 = PainLogSchema.safeParse({
    id: 'l-post-0',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: 5,
    postMedIntensity: 0,
  });
  const r10 = PainLogSchema.safeParse({
    id: 'l-post-10',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: 5,
    postMedIntensity: 10,
  });
  const rNeg = PainLogSchema.safeParse({
    id: 'l-post-neg',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: 5,
    postMedIntensity: -1,
  });
  const r11 = PainLogSchema.safeParse({
    id: 'l-post-11',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: 5,
    postMedIntensity: 11,
  });
  assert.equal(r0.success, true, 'postMedIntensity 0 should be accepted');
  assert.equal(r10.success, true, 'postMedIntensity 10 should be accepted');
  assert.equal(rNeg.success, false, 'postMedIntensity -1 should be rejected');
  assert.equal(r11.success, false, 'postMedIntensity 11 should be rejected');
});

// ----------------------------------------------------------------------------
// Group 2: High Payload & Side Effects Stress (5000 chars, special characters)
// ----------------------------------------------------------------------------
console.log('\n▶ Group 2: Side Effects and Notes Stress Testing');

testCase('ADV-2.1', 'PainLogSchema notes field enforces 5000 character maximum', () => {
  const exactly5000 = 'x'.repeat(5000);
  const tooLong5001 = 'x'.repeat(5001);

  const ok = PainLogSchema.safeParse({
    id: 'l-notes-ok',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: 5,
    notes: exactly5000,
  });
  const rejected = PainLogSchema.safeParse({
    id: 'l-notes-fail',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: 5,
    notes: tooLong5001,
  });

  assert.equal(ok.success, true, '5000 char notes should be accepted');
  assert.equal(rejected.success, false, '5001 char notes should be rejected');
});

testCase('ADV-2.2', 'PainLogSchema accepts multi-element postMedSideEffects array', () => {
  const sideEffects = ['속쓰림', '어지러움', '구역/메스꺼움', '졸림', '두드러기'];
  const res = PainLogSchema.safeParse({
    id: 'l-se-1',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: 6,
    postMedSideEffects: sideEffects,
  });
  assert.equal(res.success, true);
  assert.deepEqual(res.data.postMedSideEffects, sideEffects);
});

testCase('ADV-2.3', 'Long string in postMedSideEffects (5000 characters)', () => {
  const longSideEffect = 'x'.repeat(5000);
  const res = PainLogSchema.safeParse({
    id: 'l-se-long',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: 7,
    postMedSideEffects: [longSideEffect],
  });
  // Note: PainLogSchema defines postMedSideEffects: z.array(z.string()).optional() without max length.
  assert.equal(res.success, true, 'Schema accepts long side effect string');
  assert.equal(res.data.postMedSideEffects[0].length, 5000);
});

testCase('ADV-2.4', 'Adversarial XSS / injection payloads in side effects and medication strings', () => {
  const xssPayload = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
  const res = PainLogSchema.safeParse({
    id: 'l-xss',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: 5,
    medication: xssPayload,
    postMedSideEffects: [xssPayload],
  });
  assert.equal(res.success, true, 'Schema preserves raw strings safely without crash');
  assert.equal(res.data.medication, xssPayload);
  assert.equal(res.data.postMedSideEffects[0], xssPayload);
});

// ----------------------------------------------------------------------------
// Group 3: Missing / Empty Condition IDs & Orphaned Logs
// ----------------------------------------------------------------------------
console.log('\n▶ Group 3: Missing or Empty Condition IDs');

testCase('ADV-3.1', 'ConditionSchema rejects empty string id', () => {
  const res = ConditionSchema.safeParse({
    id: '',
    label: '두통',
    bodyPart: '머리',
    onsetDate: '2026-01-01',
    isArchived: false,
  });
  assert.equal(res.success, false, 'Empty condition ID should be rejected');
});

testCase('ADV-3.2', 'PainLogSchema rejects empty conditionId ("")', () => {
  const res = PainLogSchema.safeParse({
    id: 'l-empty-cond',
    conditionId: '',
    date: new Date().toISOString(),
    intensity: 4,
  });
  assert.equal(res.success, false, 'Empty conditionId in log should be rejected');
});

testCase('ADV-3.3', 'PainLogSchema rejects missing conditionId (undefined)', () => {
  const res = PainLogSchema.safeParse({
    id: 'l-undef-cond',
    date: new Date().toISOString(),
    intensity: 4,
  });
  assert.equal(res.success, false, 'Missing conditionId should be rejected');
});

testCase('ADV-3.4', 'Orphaned log in Dashboard & Clinical Briefing calculations does not throw', () => {
  const conditions = [
    { id: 'c-real-1', label: '허리디스크', bodyPart: '허리', onsetDate: '2026-01-01', isArchived: false },
  ];
  const logs = [
    {
      id: 'l-orphan',
      conditionId: 'c-non-existent-999',
      date: new Date().toISOString(),
      intensity: 7,
      medication: '타이레놀',
      postMedIntensity: 4,
      postMedSideEffects: ['졸림'],
    },
  ];

  // Emulate Dashboard.tsx recentMedCondition resolution
  const recentMedLog = logs[0];
  const recentMedCondition = conditions.find((c) => c.id === recentMedLog.conditionId) || null;
  assert.equal(recentMedCondition, null, 'Orphaned condition should resolve to null gracefully');

  // Emulate ClinicalBriefing condition summarization
  const activeConditions = conditions.filter((c) => !c.isArchived);
  const conditionSummaries = activeConditions.map((cond) => {
    const cLogs = logs.filter((l) => l.conditionId === cond.id);
    return {
      conditionId: cond.id,
      count: cLogs.length,
    };
  });
  assert.equal(conditionSummaries[0].count, 0, 'Active condition should have 0 logs');

  // Emulate ClinicalBriefing evaluatedMedLogs aggregation
  const evaluatedMedLogs = logs.filter(
    (l) => l.postMedIntensity !== undefined || (l.postMedSideEffects && l.postMedSideEffects.length > 0)
  );
  assert.equal(evaluatedMedLogs.length, 1, 'Orphaned med log is still evaluated in global med analytics');
  const delta = evaluatedMedLogs[0].intensity - evaluatedMedLogs[0].postMedIntensity;
  assert.equal(delta, 3, 'Delta calculation is accurate');
});

// ----------------------------------------------------------------------------
// Group 4: Elapsed Time Calculations Across Clock Skew, Future Dates, DST
// ----------------------------------------------------------------------------
console.log('\n▶ Group 4: Elapsed Time across DST, Negative Timestamps, Future Dates');

// Helper emulating Dashboard.tsx elapsed time calculation
function computeElapsedTime(logDateStr, mockNowMs) {
  const diffHours = (mockNowMs - new Date(logDateStr).getTime()) / (1000 * 60 * 60);
  const isEligibleForFollowUp = diffHours >= 0 && diffHours <= 24;

  const elapsedMinutes = Math.max(0, Math.floor((mockNowMs - new Date(logDateStr).getTime()) / (1000 * 60)));
  const elapsedBadge =
    elapsedMinutes < 60
      ? `복용 ${elapsedMinutes}분 경과`
      : `복용 ${Math.floor(elapsedMinutes / 60)}시간 ${elapsedMinutes % 60}분 경과`;

  return { diffHours, isEligibleForFollowUp, elapsedMinutes, elapsedBadge };
}

testCase('ADV-4.1', 'Normal elapsed time: 45 minutes elapsed', () => {
  const now = 1772877600000; // Reference timestamp
  const logDate = new Date(now - 45 * 60 * 1000).toISOString();
  const res = computeElapsedTime(logDate, now);

  assert.equal(res.isEligibleForFollowUp, true);
  assert.equal(res.elapsedMinutes, 45);
  assert.equal(res.elapsedBadge, '복용 45분 경과');
});

testCase('ADV-4.2', 'Normal elapsed time: 3 hours 25 minutes elapsed', () => {
  const now = 1772877600000;
  const logDate = new Date(now - (3 * 60 + 25) * 60 * 1000).toISOString();
  const res = computeElapsedTime(logDate, now);

  assert.equal(res.isEligibleForFollowUp, true);
  assert.equal(res.elapsedMinutes, 205);
  assert.equal(res.elapsedBadge, '복용 3시간 25분 경과');
});

testCase('ADV-4.3', 'Future date (Clock Skew forward by 30 minutes)', () => {
  const now = 1772877600000;
  const futureLogDate = new Date(now + 30 * 60 * 1000).toISOString();
  const res = computeElapsedTime(futureLogDate, now);

  // Future date means diffHours is negative (-0.5).
  // diffHours >= 0 && diffHours <= 24 evaluates to false!
  assert.equal(res.isEligibleForFollowUp, false, 'Future logs must not trigger immediate follow-up card');
  assert.equal(res.elapsedMinutes, 0, 'Elapsed minutes is clamped to 0 by Math.max(0, ...)');
  assert.equal(res.elapsedBadge, '복용 0분 경과');
});

testCase('ADV-4.4', 'Clock Skew: device time set back by 1 year (-365 days)', () => {
  const now = 1772877600000;
  const pastYearLogDate = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString();
  const res = computeElapsedTime(pastYearLogDate, now);

  assert.equal(res.isEligibleForFollowUp, false, 'Logs older than 24 hours must be excluded');
  assert.ok(res.diffHours > 8000, 'diffHours is huge');
});

testCase('ADV-4.5', 'Boundary elapsed time: exactly 24 hours (1440 minutes)', () => {
  const now = 1772877600000;
  const exactly24hLogDate = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const res = computeElapsedTime(exactly24hLogDate, now);

  assert.equal(res.isEligibleForFollowUp, true, 'Exactly 24.0 hours is included');
  assert.equal(res.elapsedMinutes, 1440);
  assert.equal(res.elapsedBadge, '복용 24시간 0분 경과');
});

testCase('ADV-4.6', 'Boundary elapsed time: 24 hours and 1 second (excluded)', () => {
  const now = 1772877600000;
  const over24hLogDate = new Date(now - (24 * 60 * 60 * 1000 + 1000)).toISOString();
  const res = computeElapsedTime(over24hLogDate, now);

  assert.equal(res.isEligibleForFollowUp, false, 'Log older than 24h by 1s is excluded');
});

testCase('ADV-4.7', 'Physical elapsed time across DST Spring Forward (1:59 AM to 3:01 AM UTC timestamps)', () => {
  // DST Spring Forward: Clock jumps from 02:00 to 03:00 local time.
  // In UTC epoch milliseconds: physical elapsed time is 120 seconds (2 minutes).
  const tBeforeDST = Date.UTC(2026, 2, 29, 0, 59, 0); // e.g. 00:59 UTC
  const tAfterDST = Date.UTC(2026, 2, 29, 1, 1, 0);  // 01:01 UTC (+2 minutes physical time)

  const logDate = new Date(tBeforeDST).toISOString();
  const res = computeElapsedTime(logDate, tAfterDST);

  assert.equal(res.isEligibleForFollowUp, true);
  assert.equal(res.elapsedMinutes, 2, 'Physical time elapsed is exactly 2 minutes regardless of DST jump');
  assert.equal(res.elapsedBadge, '복용 2분 경과');
});

testCase('ADV-4.8', 'Physical elapsed time across DST Fall Back (01:59 AM repeated local time)', () => {
  // DST Fall Back: Clock repeats an hour.
  // In UTC epoch milliseconds: physical elapsed time of 75 minutes is accurately 75 minutes.
  const tBeforeFall = Date.UTC(2026, 9, 25, 0, 45, 0);
  const tAfterFall = Date.UTC(2026, 9, 25, 2, 0, 0); // +75 minutes physical time

  const logDate = new Date(tBeforeFall).toISOString();
  const res = computeElapsedTime(logDate, tAfterFall);

  assert.equal(res.isEligibleForFollowUp, true);
  assert.equal(res.elapsedMinutes, 75);
  assert.equal(res.elapsedBadge, '복용 1시간 15분 경과');
});

testCase('ADV-4.9', 'Malformed date string ("not-a-valid-date") produces NaN in Math.max(0, NaN)', () => {
  const now = 1772877600000;
  const res = computeElapsedTime('not-a-valid-date', now);

  // In JavaScript, Math.max(0, NaN) is NaN!
  // However, diffHours is NaN, so diffHours >= 0 && diffHours <= 24 evaluates to false!
  // Therefore, Dashboard guards against showing the card at all.
  assert.equal(res.isEligibleForFollowUp, false, 'Malformed date does not match follow-up card eligibility');
  assert.ok(Number.isNaN(res.elapsedMinutes), 'Math.max(0, NaN) yields NaN in JavaScript');
});

// ----------------------------------------------------------------------------
// Group 6: HealthDataPayloadSchema vs PainLogSchema Validation Gaps
// ----------------------------------------------------------------------------
console.log('\n▶ Group 6: Schema Integrity & State Mutation Challenges');

testCase('ADV-6.1', 'HealthDataPayloadSchema fails to reject invalid log intensity due to z.custom()', () => {
  const invalidPayload = {
    conditions: [{ id: 'c-1', label: '두통', bodyPart: '머리', onsetDate: '2026-01-01', isArchived: false }],
    logs: [
      {
        id: 'l-bad',
        conditionId: 'c-1',
        date: new Date().toISOString(),
        intensity: 999, // Should be 1-10!
      },
    ],
    diaryEntries: [],
  };

  const parsed = HealthDataPayloadSchema.safeParse(invalidPayload);
  // Because Worker M1 changed `logs: z.array(PainLogSchema)` to `logs: z.array(z.custom<PainLog>())`,
  // z.custom() without a predicate returns true for ANY log!
  // This is a documented architectural vulnerability:
  if (parsed.success) {
    console.warn('    [WARNING] HealthDataPayloadSchema allows intensity: 999 because z.custom() lacks a validator predicate!');
  }
  assert.equal(parsed.success, true, 'Empirically confirms z.custom() bypasses PainLogSchema validation');
});

testCase('ADV-6.2', 'HealthDataPayloadSchema fails to reject empty conditionId in logs array', () => {
  const invalidPayload = {
    conditions: [{ id: 'c-1', label: '두통', bodyPart: '머리', onsetDate: '2026-01-01', isArchived: false }],
    logs: [
      {
        id: 'l-bad',
        conditionId: '', // Empty conditionId!
        date: new Date().toISOString(),
        intensity: 5,
      },
    ],
    diaryEntries: [],
  };

  const parsed = HealthDataPayloadSchema.safeParse(invalidPayload);
  assert.equal(parsed.success, true, 'Empirically confirms z.custom() bypasses conditionId validation');
});

testCase('ADV-6.3', 'Dashboard.tsx follow-up card unmounts immediately upon saving, masking medRatingSaved', () => {
  // Trace Dashboard.tsx state flow:
  // 1. Initial state: logs has 1 unevaluated med log.
  const medLog = {
    id: 'l-med-1',
    conditionId: 'c-1',
    date: new Date().toISOString(),
    intensity: 7,
    medication: '타이레놀',
    postMedIntensity: undefined,
  };
  let logs = [medLog];

  // Helper matching Dashboard.tsx line 258:
  const getRecentMedLog = (currentLogs) => currentLogs.find((l) => {
    if (!l.medication || l.medication.trim().length === 0) return false;
    if (l.postMedIntensity !== undefined && l.postMedIntensity !== null) return false;
    const diffHours = (Date.now() - new Date(l.date).getTime()) / (1000 * 60 * 60);
    return diffHours >= 0 && diffHours <= 24;
  });

  assert.ok(getRecentMedLog(logs), 'Initial unevaluated med log is found');

  // 2. User taps response: handleSelectMedResponse calls updateLog and setMedRatingSaved(true)
  // After updateLog:
  logs = logs.map((l) => l.id === 'l-med-1' ? { ...l, postMedIntensity: 4 } : l);

  // 3. Next render in Dashboard:
  const nextMedLog = getRecentMedLog(logs);
  assert.equal(nextMedLog, undefined, 'recentMedLog becomes undefined immediately');
  // In Dashboard.tsx: {recentMedLog && ( <Card> {medRatingSaved ? ... : ...} </Card> )}
  // Because recentMedLog is undefined, the parent Card unmounts, hiding medRatingSaved feedback!
});

// ----------------------------------------------------------------------------
// Group 5: Rapid Burst Logging & High Concurrency Simulation
// ----------------------------------------------------------------------------
console.log('\n▶ Group 5: Rapid Burst Logging Simulation');

testCase('ADV-5.1', 'Simulate 100 rapid consecutive logs generated in sub-second intervals', () => {
  const baseTime = Date.now();
  const burstLogs = [];

  for (let i = 0; i < 100; i++) {
    const intensity = (i % 10) + 1; // 1 to 10
    const log = {
      id: `burst-log-${i}`,
      conditionId: 'c-burst',
      date: new Date(baseTime + i * 10).toISOString(), // 10ms apart
      intensity,
      medication: i % 2 === 0 ? '타이레놀' : '',
    };
    const parsed = PainLogSchema.safeParse(log);
    assert.equal(parsed.success, true, `Log ${i} failed validation`);
    burstLogs.push(parsed.data);
  }

  assert.equal(burstLogs.length, 100);
  // Sort descending
  const sorted = [...burstLogs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  assert.equal(sorted[0].id, 'burst-log-99');
  assert.equal(sorted[99].id, 'burst-log-0');
});

testCase('ADV-5.2', 'Rapid 1-tap evaluation delta clamping', () => {
  // Test delta options for varying initial intensities (1, 2, 5, 10)
  const scenarios = [
    { initial: 1, muchBetter: 0, better: 0, same: 1, worse: 2 },
    { initial: 2, muchBetter: 0, better: 1, same: 2, worse: 3 },
    { initial: 5, muchBetter: 2, better: 4, same: 5, worse: 6 },
    { initial: 10, muchBetter: 7, better: 9, same: 10, worse: 10 },
  ];

  for (const s of scenarios) {
    const muchBetter = Math.max(0, s.initial - 3);
    const better = Math.max(0, s.initial - 1);
    const same = s.initial;
    const worse = Math.min(10, s.initial + 1);

    assert.equal(muchBetter, s.muchBetter, `muchBetter for ${s.initial}`);
    assert.equal(better, s.better, `better for ${s.initial}`);
    assert.equal(same, s.same, `same for ${s.initial}`);
    assert.equal(worse, s.worse, `worse for ${s.initial}`);
  }
});

// ----------------------------------------------------------------------------
// Summary
// ----------------------------------------------------------------------------
console.log('\n----------------------------------------------------------------------');
console.log(`Results: ${passedTests} passed, ${failedTests} failed out of ${totalTests} stress tests.`);
console.log('----------------------------------------------------------------------\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('All empirical stress tests passed successfully.');
}
