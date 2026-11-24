const db = require('../database');

const OWNER_ID = '1530872106399567941';
const PREMIUM_MONTHS = Object.freeze({
  '1m': 1,
  '3m': 3,
  '6m': 6
});
const NO_PREFIX_MONTHS = Object.freeze({
  '1m': 1,
  '3m': 3
});
const PREMIUM_DURATIONS = Object.freeze([
  ...Object.keys(PREMIUM_MONTHS),
  'lifetime'
]);
const NO_PREFIX_DURATIONS = Object.freeze([
  ...Object.keys(NO_PREFIX_MONTHS),
  'lifetime'
]);
const DURATION_LABELS = Object.freeze({
  '1m': '1 month',
  '3m': '3 months',
  '6m': '6 months',
  lifetime: 'lifetime'
});

function addCalendarMonths(timestamp, months) {
  const current = new Date(timestamp);
  const targetMonth = new Date(Date.UTC(
    current.getUTCFullYear(),
    current.getUTCMonth() + months,
    1
  ));
  const year = targetMonth.getUTCFullYear();
  const month = targetMonth.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(current.getUTCDate(), lastDay);

  return Date.UTC(
    year,
    month,
    day,
    current.getUTCHours(),
    current.getUTCMinutes(),
    current.getUTCSeconds(),
    current.getUTCMilliseconds()
  );
}

function expirationFor(duration, monthOptions) {
  if (duration === 'lifetime') return null;
  const months = monthOptions[duration];
  if (!months) return undefined;
  return addCalendarMonths(Date.now(), months);
}

function buildGrant(duration, monthOptions) {
  const expiresAt = expirationFor(duration, monthOptions);
  if (expiresAt === undefined) return null;

  return {
    duration,
    grantedAt: Date.now(),
    expiresAt
  };
}

async function hasActiveGrant(key) {
  const stored = await db.get(key);

  // Keep legacy `noprefix add @user` boolean grants permanent.
  if (stored === true) return true;
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return false;
  if (!Object.prototype.hasOwnProperty.call(stored, 'expiresAt')) return false;
  if (stored.expiresAt === null) return true;

  const expiresAt = Number(stored.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    await db.delete(key);
    return false;
  }

  return true;
}

async function activatePremium(userId, duration) {
  const grant = buildGrant(duration, PREMIUM_MONTHS);
  if (!grant) return null;
  await db.set(`premium_${userId}`, grant);
  return grant;
}

async function activateNoPrefix(userId, duration) {
  const grant = buildGrant(duration, NO_PREFIX_MONTHS);
  if (!grant) return null;
  await db.set(`noprefix_${userId}`, grant);
  return grant;
}

async function hasPremium(userId) {
  if (userId === OWNER_ID) return true;
  return hasActiveGrant(`premium_${userId}`);
}

async function hasStandaloneNoPrefix(userId) {
  if (userId === OWNER_ID) return true;
  return hasActiveGrant(`noprefix_${userId}`);
}

async function hasNoPrefix(userId) {
  if (userId === OWNER_ID) return true;
  if (await hasStandaloneNoPrefix(userId)) return true;
  return hasPremium(userId);
}

function formatDuration(duration) {
  return DURATION_LABELS[duration] || duration;
}

function formatExpiration(expiresAt) {
  if (expiresAt === null) return 'Lifetime access; it will not expire.';
  const timestamp = Math.floor(expiresAt / 1000);
  return `Expires <t:${timestamp}:F> (<t:${timestamp}:R>).`;
}

module.exports = {
  OWNER_ID,
  PREMIUM_DURATIONS,
  NO_PREFIX_DURATIONS,
  activatePremium,
  activateNoPrefix,
  hasPremium,
  hasNoPrefix,
  hasStandaloneNoPrefix,
  formatDuration,
  formatExpiration
};
