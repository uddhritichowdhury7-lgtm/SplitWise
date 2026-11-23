const test = require('node:test');
const assert = require('node:assert/strict');
const { toPaise, splitEqually } = require('../lib/money');

test('rupee amounts convert to paise without losing decimals', () => {
  assert.equal(toPaise(10.01), 1001);
  assert.equal(toPaise('125'), 12500);
  assert.equal(toPaise('0.05'), 5);
});
test('paise values remain exact integers', () => {
  assert.equal(toPaise(1001, true), 1001);
  assert.ok(Number.isNaN(toPaise(1.5, true)));
});
test('equal split allocates every paise including remainder', () => {
  const shares = splitEqually(1001, [11, 12, 13]);
  assert.deepEqual(shares, [{userId:11,sharePaise:334},{userId:12,sharePaise:334},{userId:13,sharePaise:333}]);
  assert.equal(shares.reduce((sum, item) => sum + item.sharePaise, 0), 1001);
});
test('split rejects an empty member list', () => {
  assert.throws(() => splitEqually(100, []));
});
