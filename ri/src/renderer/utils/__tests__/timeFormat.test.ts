import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatRelativeTime, getActivityStatus } from '../timeFormat';

describe('timeFormat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatRelativeTime', () => {
    describe('just now (< 10 seconds)', () => {
      it('should return "just now" for 0 seconds ago', () => {
        const now = Date.now();
        expect(formatRelativeTime(now)).toBe('just now');
      });

      it('should return "just now" for 5 seconds ago', () => {
        const fiveSecondsAgo = Date.now() - 5000;
        expect(formatRelativeTime(fiveSecondsAgo)).toBe('just now');
      });

      it('should return "just now" for 9 seconds ago', () => {
        const nineSecondsAgo = Date.now() - 9000;
        expect(formatRelativeTime(nineSecondsAgo)).toBe('just now');
      });
    });

    describe('seconds format (< 60 seconds)', () => {
      it('should return "10s ago" for 10 seconds ago', () => {
        const tenSecondsAgo = Date.now() - 10000;
        expect(formatRelativeTime(tenSecondsAgo)).toBe('10s ago');
      });

      it('should return "30s ago" for 30 seconds ago', () => {
        const thirtySecondsAgo = Date.now() - 30000;
        expect(formatRelativeTime(thirtySecondsAgo)).toBe('30s ago');
      });

      it('should return "59s ago" for 59 seconds ago', () => {
        const fiftyNineSecondsAgo = Date.now() - 59000;
        expect(formatRelativeTime(fiftyNineSecondsAgo)).toBe('59s ago');
      });

      it('should round down seconds correctly', () => {
        const twentyFivePointFiveSecondsAgo = Date.now() - 25500;
        expect(formatRelativeTime(twentyFivePointFiveSecondsAgo)).toBe('25s ago');
      });
    });

    describe('minutes format (< 60 minutes)', () => {
      it('should return "1m ago" for 60 seconds ago', () => {
        const oneMinuteAgo = Date.now() - 60000;
        expect(formatRelativeTime(oneMinuteAgo)).toBe('1m ago');
      });

      it('should return "5m ago" for 5 minutes ago', () => {
        const fiveMinutesAgo = Date.now() - 5 * 60000;
        expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
      });

      it('should return "30m ago" for 30 minutes ago', () => {
        const thirtyMinutesAgo = Date.now() - 30 * 60000;
        expect(formatRelativeTime(thirtyMinutesAgo)).toBe('30m ago');
      });

      it('should return "59m ago" for 59 minutes ago', () => {
        const fiftyNineMinutesAgo = Date.now() - 59 * 60000;
        expect(formatRelativeTime(fiftyNineMinutesAgo)).toBe('59m ago');
      });

      it('should round down minutes correctly', () => {
        const twoMinutesThirtySecondsAgo = Date.now() - 2 * 60000 - 30000;
        expect(formatRelativeTime(twoMinutesThirtySecondsAgo)).toBe('2m ago');
      });
    });

    describe('hours format (< 24 hours)', () => {
      it('should return "1h ago" for 1 hour ago', () => {
        const oneHourAgo = Date.now() - 60 * 60000;
        expect(formatRelativeTime(oneHourAgo)).toBe('1h ago');
      });

      it('should return "2h ago" for 2 hours ago', () => {
        const twoHoursAgo = Date.now() - 2 * 60 * 60000;
        expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
      });

      it('should return "12h ago" for 12 hours ago', () => {
        const twelveHoursAgo = Date.now() - 12 * 60 * 60000;
        expect(formatRelativeTime(twelveHoursAgo)).toBe('12h ago');
      });

      it('should return "23h ago" for 23 hours ago', () => {
        const twentyThreeHoursAgo = Date.now() - 23 * 60 * 60000;
        expect(formatRelativeTime(twentyThreeHoursAgo)).toBe('23h ago');
      });

      it('should round down hours correctly', () => {
        const fiveHoursThirtyMinutesAgo = Date.now() - 5 * 60 * 60000 - 30 * 60000;
        expect(formatRelativeTime(fiveHoursThirtyMinutesAgo)).toBe('5h ago');
      });
    });

    describe('days format (< 7 days)', () => {
      it('should return "1d ago" for 1 day ago', () => {
        const oneDayAgo = Date.now() - 24 * 60 * 60000;
        expect(formatRelativeTime(oneDayAgo)).toBe('1d ago');
      });

      it('should return "3d ago" for 3 days ago', () => {
        const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60000;
        expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
      });

      it('should return "6d ago" for 6 days ago', () => {
        const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60000;
        expect(formatRelativeTime(sixDaysAgo)).toBe('6d ago');
      });

      it('should round down days correctly', () => {
        const twoPointFiveDaysAgo = Date.now() - 2 * 24 * 60 * 60000 - 12 * 60 * 60000;
        expect(formatRelativeTime(twoPointFiveDaysAgo)).toBe('2d ago');
      });
    });

    describe('date format (>= 7 days)', () => {
      it('should return date string for 7 days ago', () => {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60000;
        const result = formatRelativeTime(sevenDaysAgo);
        expect(result).not.toContain('ago');
        expect(result).toMatch(/\d+\/\d+\/\d+/);
      });

      it('should return date string for 30 days ago', () => {
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60000;
        const result = formatRelativeTime(thirtyDaysAgo);
        expect(result).not.toContain('ago');
        expect(result).toMatch(/\d+\/\d+\/\d+/);
      });

      it('should return date string for 1 year ago', () => {
        const oneYearAgo = Date.now() - 365 * 24 * 60 * 60000;
        const result = formatRelativeTime(oneYearAgo);
        expect(result).not.toContain('ago');
        expect(result).toMatch(/\d+\/\d+\/\d+/);
      });

      it('should format date correctly with local date representation', () => {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60000;
        const result = formatRelativeTime(sevenDaysAgo);
        const date = new Date(sevenDaysAgo);
        const expectedDateString = date.toLocaleDateString();
        expect(result).toBe(expectedDateString);
      });
    });

    describe('edge cases', () => {
      it('should handle boundary between "just now" and seconds', () => {
        const tenSecondsAgo = Date.now() - 10000;
        const nineSecondsAgo = Date.now() - 9000;
        expect(formatRelativeTime(tenSecondsAgo)).toBe('10s ago');
        expect(formatRelativeTime(nineSecondsAgo)).toBe('just now');
      });

      it('should handle boundary between seconds and minutes', () => {
        const sixtySecondsAgo = Date.now() - 60000;
        const fiftyNineSecondsAgo = Date.now() - 59000;
        expect(formatRelativeTime(sixtySecondsAgo)).toBe('1m ago');
        expect(formatRelativeTime(fiftyNineSecondsAgo)).toBe('59s ago');
      });

      it('should handle boundary between minutes and hours', () => {
        const sixtyMinutesAgo = Date.now() - 60 * 60000;
        const fiftyNineMinutesAgo = Date.now() - 59 * 60000;
        expect(formatRelativeTime(sixtyMinutesAgo)).toBe('1h ago');
        expect(formatRelativeTime(fiftyNineMinutesAgo)).toBe('59m ago');
      });

      it('should handle boundary between hours and days', () => {
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60000;
        const twentyThreeHoursAgo = Date.now() - 23 * 60 * 60000;
        expect(formatRelativeTime(twentyFourHoursAgo)).toBe('1d ago');
        expect(formatRelativeTime(twentyThreeHoursAgo)).toBe('23h ago');
      });

      it('should handle boundary between days and date format', () => {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60000;
        const sixDaysAgo = Date.now() - 6 * 24 * 60 * 60000;
        const resultSevenDays = formatRelativeTime(sevenDaysAgo);
        const resultSixDays = formatRelativeTime(sixDaysAgo);
        expect(resultSevenDays).not.toContain('ago');
        expect(resultSixDays).toBe('6d ago');
      });

      it('should handle very recent timestamps', () => {
        const justNow = Date.now();
        expect(formatRelativeTime(justNow)).toBe('just now');
      });

      it('should handle future timestamps (negative diff)', () => {
        const futureTime = Date.now() + 10000;
        const result = formatRelativeTime(futureTime);
        expect(result).toBe('just now');
      });
    });
  });

  describe('getActivityStatus', () => {
    describe('active status (< 5 minutes)', () => {
      it('should return "active" for 0 seconds ago', () => {
        const now = Date.now();
        expect(getActivityStatus(now)).toBe('active');
      });

      it('should return "active" for 2 minutes ago', () => {
        const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
        expect(getActivityStatus(twoMinutesAgo)).toBe('active');
      });

      it('should return "active" for 4 minutes 59 seconds ago', () => {
        const fourMinutesFiftyNineSecondsAgo = Date.now() - (4 * 60 + 59) * 1000;
        expect(getActivityStatus(fourMinutesFiftyNineSecondsAgo)).toBe('active');
      });

      it('should return "active" for just under 5 minutes', () => {
        const almostFiveMinutesAgo = Date.now() - (5 * 60 * 1000 - 1);
        expect(getActivityStatus(almostFiveMinutesAgo)).toBe('active');
      });
    });

    describe('recent status (>= 5 minutes and < 30 minutes)', () => {
      it('should return "recent" for 5 minutes ago', () => {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        expect(getActivityStatus(fiveMinutesAgo)).toBe('recent');
      });

      it('should return "recent" for 15 minutes ago', () => {
        const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
        expect(getActivityStatus(fifteenMinutesAgo)).toBe('recent');
      });

      it('should return "recent" for 29 minutes ago', () => {
        const twentyNineMinutesAgo = Date.now() - 29 * 60 * 1000;
        expect(getActivityStatus(twentyNineMinutesAgo)).toBe('recent');
      });

      it('should return "recent" for just under 30 minutes', () => {
        const almostThirtyMinutesAgo = Date.now() - (30 * 60 * 1000 - 1);
        expect(getActivityStatus(almostThirtyMinutesAgo)).toBe('recent');
      });
    });

    describe('idle status (>= 30 minutes and < 24 hours)', () => {
      it('should return "idle" for 30 minutes ago', () => {
        const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
        expect(getActivityStatus(thirtyMinutesAgo)).toBe('idle');
      });

      it('should return "idle" for 1 hour ago', () => {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        expect(getActivityStatus(oneHourAgo)).toBe('idle');
      });

      it('should return "idle" for 12 hours ago', () => {
        const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
        expect(getActivityStatus(twelveHoursAgo)).toBe('idle');
      });

      it('should return "idle" for 23 hours 59 minutes ago', () => {
        const almostTwentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000 - 1);
        expect(getActivityStatus(almostTwentyFourHoursAgo)).toBe('idle');
      });
    });

    describe('stale status (>= 24 hours)', () => {
      it('should return "stale" for 24 hours ago', () => {
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
        expect(getActivityStatus(twentyFourHoursAgo)).toBe('stale');
      });

      it('should return "stale" for 2 days ago', () => {
        const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
        expect(getActivityStatus(twoDaysAgo)).toBe('stale');
      });

      it('should return "stale" for 7 days ago', () => {
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        expect(getActivityStatus(sevenDaysAgo)).toBe('stale');
      });

      it('should return "stale" for 1 year ago', () => {
        const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
        expect(getActivityStatus(oneYearAgo)).toBe('stale');
      });

      it('should return "stale" for just over 24 hours', () => {
        const justOverTwentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000 + 1);
        expect(getActivityStatus(justOverTwentyFourHoursAgo)).toBe('stale');
      });
    });

    describe('boundary conditions', () => {
      it('should handle boundary between active and recent at 5 minutes', () => {
        const exactlyFiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        expect(getActivityStatus(exactlyFiveMinutesAgo)).toBe('recent');
      });

      it('should handle boundary between recent and idle at 30 minutes', () => {
        const exactlyThirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
        expect(getActivityStatus(exactlyThirtyMinutesAgo)).toBe('idle');
      });

      it('should handle boundary between idle and stale at 24 hours', () => {
        const exactlyTwentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
        expect(getActivityStatus(exactlyTwentyFourHoursAgo)).toBe('stale');
      });
    });

    describe('edge cases', () => {
      it('should handle current timestamp', () => {
        expect(getActivityStatus(Date.now())).toBe('active');
      });

      it('should handle very old timestamps', () => {
        const veryOldTime = Date.now() - 100 * 365 * 24 * 60 * 60 * 1000;
        expect(getActivityStatus(veryOldTime)).toBe('stale');
      });

      it('should handle future timestamps gracefully', () => {
        const futureTime = Date.now() + 10000;
        const result = getActivityStatus(futureTime);
        expect(['active', 'recent', 'idle', 'stale']).toContain(result);
      });
    });

    describe('precision with milliseconds', () => {
      it('should correctly calculate status with millisecond precision', () => {
        const fourMinutes = Date.now() - 4 * 60 * 1000;
        const fiveMinutes = Date.now() - 5 * 60 * 1000;
        const oneSecondBefore5Min = Date.now() - (5 * 60 * 1000 - 1000);

        expect(getActivityStatus(fourMinutes)).toBe('active');
        expect(getActivityStatus(fiveMinutes)).toBe('recent');
        expect(getActivityStatus(oneSecondBefore5Min)).toBe('active');
      });
    });
  });
});
