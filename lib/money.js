function toPaise(value, alreadyPaise = false) {
  if (alreadyPaise) return Number.isSafeInteger(value) && value >= 0 ? value : NaN;
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return Math.round(value * 100);
  if (typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value.trim())) return Math.round(Number(value) * 100);
  return NaN;
}
function splitEqually(totalPaise, userIds) {
  if (!Number.isSafeInteger(totalPaise) || totalPaise < 0 || !Array.isArray(userIds) || !userIds.length) throw new Error('A non-negative integer total and at least one user are required');
  const base = Math.floor(totalPaise / userIds.length), remainder = totalPaise % userIds.length;
  return userIds.map((userId, index) => ({ userId, sharePaise: base + (index < remainder ? 1 : 0) }));
}
module.exports = { toPaise, splitEqually };
