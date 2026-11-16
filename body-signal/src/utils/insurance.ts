import { addYears, subDays, differenceInCalendarDays, format, parseISO, isValid } from 'date-fns';

export type ClaimUrgency = 'claimed' | 'not_applicable' | 'expired' | 'critical' | 'soon' | 'safe';

export interface InsuranceDeadlineInfo {
  diagnosisDate: string;
  deadlineDate: string;
  recommendedLatestDate: string;
  daysRemaining: number;
  urgency: ClaimUrgency;
  badgeText: string;
}

/**
 * Calculates the statutory Korean indemnity insurance claim deadline (default: 3 years
 * under Commercial Act Art. 662) and a safe "latest recommended claim date" (14 days prior)
 * so users can defer claiming as late as possible without missing the expiration window.
 */
export function calculateInsuranceClaimStatus(
  diagnosisDateStr: string,
  claimStatus: 'pending' | 'claimed' | 'not_applicable' = 'pending',
  years: number = 3,
  referenceDate: Date = new Date()
): InsuranceDeadlineInfo {
  const parsed = parseISO(diagnosisDateStr);
  const safeBase = isValid(parsed) ? parsed : referenceDate;
  const deadline = addYears(safeBase, Math.max(1, years));
  const recommendedLatest = subDays(deadline, 14);

  const refDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const deadlineDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const daysRemaining = differenceInCalendarDays(deadlineDay, refDay);

  const deadlineDate = format(deadline, 'yyyy-MM-dd');
  const recommendedLatestDate = format(recommendedLatest, 'yyyy-MM-dd');

  if (claimStatus === 'claimed') {
    return {
      diagnosisDate: diagnosisDateStr,
      deadlineDate,
      recommendedLatestDate,
      daysRemaining,
      urgency: 'claimed',
      badgeText: '청구 완료',
    };
  }

  if (claimStatus === 'not_applicable') {
    return {
      diagnosisDate: diagnosisDateStr,
      deadlineDate,
      recommendedLatestDate,
      daysRemaining,
      urgency: 'not_applicable',
      badgeText: '청구 대상 아님',
    };
  }

  if (daysRemaining < 0) {
    return {
      diagnosisDate: diagnosisDateStr,
      deadlineDate,
      recommendedLatestDate,
      daysRemaining,
      urgency: 'expired',
      badgeText: `시효 만료 (${Math.abs(daysRemaining)}일 경과)`,
    };
  }

  if (daysRemaining === 0) {
    return {
      diagnosisDate: diagnosisDateStr,
      deadlineDate,
      recommendedLatestDate,
      daysRemaining,
      urgency: 'critical',
      badgeText: 'D-Day (오늘 마감)',
    };
  }

  if (daysRemaining <= 14) {
    return {
      diagnosisDate: diagnosisDateStr,
      deadlineDate,
      recommendedLatestDate,
      daysRemaining,
      urgency: 'critical',
      badgeText: `마감 임박 D-${daysRemaining}`,
    };
  }

  if (daysRemaining <= 60) {
    return {
      diagnosisDate: diagnosisDateStr,
      deadlineDate,
      recommendedLatestDate,
      daysRemaining,
      urgency: 'soon',
      badgeText: `마감 주의 D-${daysRemaining}`,
    };
  }

  return {
    diagnosisDate: diagnosisDateStr,
    deadlineDate,
    recommendedLatestDate,
    daysRemaining,
    urgency: 'safe',
    badgeText: `청구 여유 D-${daysRemaining}`,
  };
}
