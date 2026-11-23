require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const authenticateToken = require('./middleware/auth');
const { toPaise, splitEqually } = require('./lib/money');
const { encrypt, decrypt } = require('./lib/crypto');
const crypto = require('node:crypto');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to at least 32 characters. Copy .env.example to .env and change it.');
}
const app = express();
const prisma = new PrismaClient();
const PORT = Number(process.env.PORT || 5000);
app.use(express.json({ limit: '100kb' }));
app.use(express.static(require('path').join(__dirname, 'public')));
app.use('/api/personal', require('./routes/personal-finance')(prisma, authenticateToken));

const safeUser = { id: true, name: true, email: true, createdAt: true };
const fail = (res, status, message) => res.status(status).json({ success: false, message });

app.get('/', (_req, res) => res.sendFile(require('path').join(__dirname, 'public', 'index.html')));
app.get('/api/health', async (_req, res) => {
  try { await prisma.$queryRaw`SELECT 1`; res.json({ success: true, message: 'Expense Tracker API is healthy' }); }
  catch { fail(res, 503, 'Database is not ready. Run npm run db:setup.'); }
});
app.get('/test-db', async (_req, res) => {
  try { await prisma.$connect(); res.json({ success: true, message: 'Database connected successfully!' }); }
  catch { fail(res, 500, 'Database connection failed'); }
});

app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (![name, email, password].every(v => typeof v === 'string' && v.trim())) return fail(res, 400, 'Name, email, and password are required');
    if (password.length < 8) return fail(res, 400, 'Password must be at least 8 characters');
    const user = await prisma.user.create({ data: { name: name.trim(), email: email.trim().toLowerCase(), password: await bcrypt.hash(password, 12) }, select: safeUser });
    res.status(201).json({ success: true, message: 'Registration successful', user });
  } catch (e) { if (e.code === 'P2002') return fail(res, 409, 'Email is already registered'); console.error(e); fail(res, 500, 'Registration failed'); }
});
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) return fail(res, 400, 'Email and password are required');
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.password))) return fail(res, 401, 'Invalid email or password');
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '12h' });
    res.json({ success: true, message: 'Login successful', token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (e) { console.error(e); fail(res, 500, 'Login failed'); }
});
app.get('/profile', authenticateToken, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: safeUser });
  if (!user) return fail(res, 404, 'User not found'); res.json({ success: true, user });
});

app.put('/profile/payment-account', authenticateToken, async (req, res) => {
  const accountId = String(req.body?.razorpayAccountId || '').trim();
  if (accountId && !/^acc_[A-Za-z0-9]{6,}$/.test(accountId)) return fail(res, 400, 'Enter a valid Razorpay Linked Account ID (acc_...)');
  await prisma.user.update({ where: { id: req.user.userId }, data: { razorpayAccountId: accountId || null } });
  res.json({ success: true, message: accountId ? 'Payout account saved' : 'Payout account removed' });
});
app.get('/users', authenticateToken, async (_req, res) => {
  const users = await prisma.user.findMany({ select: safeUser, orderBy: { name: 'asc' } }); res.json({ success: true, count: users.length, users });
});
app.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, email, password } = req.body || {}, data = {};
    if (name === undefined && email === undefined && password === undefined) return fail(res, 400, 'Provide name, email, or password');
    if (name !== undefined) { if (typeof name !== 'string' || !name.trim()) return fail(res, 400, 'Name must not be empty'); data.name = name.trim(); }
    if (email !== undefined) { if (typeof email !== 'string' || !email.trim()) return fail(res, 400, 'Email must not be empty'); data.email = email.trim().toLowerCase(); }
    if (password !== undefined) { if (typeof password !== 'string' || password.length < 8) return fail(res, 400, 'Password must be at least 8 characters'); data.password = await bcrypt.hash(password, 12); }
    const user = await prisma.user.update({ where: { id: req.user.userId }, data, select: safeUser }); res.json({ success: true, user });
  } catch (e) { if (e.code === 'P2002') return fail(res, 409, 'Email is already registered'); console.error(e); fail(res, 500, 'Could not update profile'); }
});
app.delete('/profile', authenticateToken, async (req, res) => {
  try { await prisma.user.delete({ where: { id: req.user.userId } }); res.json({ success: true, message: 'Account deleted' }); }
  catch (e) { console.error(e); fail(res, 500, 'Could not delete account'); }
});

async function groupForUser(groupId, userId) {
  return prisma.group.findFirst({ where: { id: Number(groupId), members: { some: { userId } } }, include: { members: { include: { user: { select: safeUser } } } } });
}
app.get('/api/groups', authenticateToken, async (req, res) => {
  const groups = await prisma.group.findMany({ where: { members: { some: { userId: req.user.userId } } }, include: { members: { include: { user: { select: safeUser } } }, _count: { select: { expenses: true } } }, orderBy: { createdAt: 'desc' } });
  res.json({ success: true, groups });
});
app.post('/api/groups', authenticateToken, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!name) return fail(res, 400, 'Group name is required');
  const group = await prisma.group.create({ data: { name, creatorId: req.user.userId, members: { create: { userId: req.user.userId } } }, include: { members: { include: { user: { select: safeUser } } } } });
  res.status(201).json({ success: true, group });
});
app.post('/api/groups/:id/members', authenticateToken, async (req, res) => {
  const group = await groupForUser(req.params.id, req.user.userId); if (!group) return fail(res, 404, 'Group not found');
  const userId = Number(req.body?.userId); if (!Number.isInteger(userId)) return fail(res, 400, 'A valid userId is required');
  const user = await prisma.user.findUnique({ where: { id: userId }, select: safeUser }); if (!user) return fail(res, 404, 'User not found');
  try { await prisma.groupMember.create({ data: { groupId: group.id, userId } }); }
  catch (e) { if (e.code === 'P2002') return fail(res, 409, 'User is already in this group'); throw e; }
  res.status(201).json({ success: true, message: 'Member added', user });
});
app.get('/api/groups/:id', authenticateToken, async (req, res) => {
  const group = await groupForUser(req.params.id, req.user.userId); if (!group) return fail(res, 404, 'Group not found');
  const expenses = await prisma.expense.findMany({ where: { groupId: group.id }, include: { payer: { select: safeUser }, splits: { include: { user: { select: safeUser } } } }, orderBy: { createdAt: 'desc' } });
  const payments = await prisma.payment.findMany({ where: { groupId: group.id }, include: { sender: { select: safeUser }, allocations: { include: { recipient: { select: safeUser } } } }, orderBy: { createdAt: 'desc' } });
  const balances = Object.fromEntries(group.members.map(m => [m.userId, 0]));
  for (const expense of expenses) { balances[expense.payerId] += expense.amountPaise; for (const split of expense.splits) balances[split.userId] -= split.sharePaise; }
  for (const payment of payments) for (const allocation of payment.allocations) { balances[payment.senderId] += allocation.amountPaise; balances[allocation.recipientId] -= allocation.amountPaise; }
  res.json({ success: true, group, expenses, payments, balances: group.members.map(m => ({ user: m.user, balancePaise: balances[m.userId] })) });
});
app.post('/api/expenses', authenticateToken, async (req, res) => {
  const groupId = Number(req.body?.groupId), description = String(req.body?.description || '').trim(), amountPaise = toPaise(req.body?.amountPaise ?? req.body?.amount, req.body?.amountPaise !== undefined);
  const group = await groupForUser(groupId, req.user.userId); if (!group) return fail(res, 404, 'Group not found');
  if (!description || !Number.isSafeInteger(amountPaise) || amountPaise <= 0) return fail(res, 400, 'Description and a positive amount are required');
  const memberIds = group.members.map(m => m.userId), splitIds = Array.isArray(req.body?.splitUserIds) ? [...new Set(req.body.splitUserIds.map(Number))] : memberIds;
  if (!splitIds.length || splitIds.some(id => !memberIds.includes(id))) return fail(res, 400, 'Splits must include valid group members');
  const splits = splitEqually(amountPaise, splitIds);
  const expense = await prisma.expense.create({ data: { groupId, payerId: req.user.userId, description, amountPaise, splits: { create: splits } }, include: { payer: { select: safeUser }, splits: { include: { user: { select: safeUser } } } } });
  res.status(201).json({ success: true, expense });
});

// Razorpay Route: creates one checkout order and pre-configures exact recipient transfers.
// Real transfers require an approved Razorpay Route merchant account and recipient Linked Accounts.
app.post('/api/payments/route-order', authenticateToken, async (req, res) => {
  try {
    const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return fail(res, 503, 'Live payments are not configured. Add Razorpay test/live credentials first.');
    const groupId = Number(req.body?.groupId);
    const totalPaise = toPaise(req.body?.totalPaise, true);
    const raw = req.body?.allocations;
    const group = await groupForUser(groupId, req.user.userId);
    if (!group) return fail(res, 404, 'Group not found');
    if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0 || !Array.isArray(raw) || !raw.length) return fail(res, 400, 'A positive total and recipient allocations are required');
    const recipients = raw.map(a => ({ recipientId: Number(a.recipientId), amountPaise: toPaise(a.amountPaise, true) }));
    if (recipients.some(a => !Number.isInteger(a.recipientId) || a.recipientId === req.user.userId || !group.members.some(m => m.userId === a.recipientId) || !Number.isSafeInteger(a.amountPaise) || a.amountPaise <= 0)) return fail(res, 400, 'Every recipient must be another group member and every amount must be positive');
    if (recipients.reduce((sum, a) => sum + a.amountPaise, 0) !== totalPaise) return fail(res, 400, 'Recipient allocations must equal the checkout total exactly');
    const users = await prisma.user.findMany({ where: { id: { in: recipients.map(a => a.recipientId) } }, select: { id: true, razorpayAccountId: true } });
    const accountByUser = new Map(users.map(u => [u.id, u.razorpayAccountId]));
    if (recipients.some(a => !accountByUser.get(a.recipientId))) return fail(res, 400, 'Every recipient must first save an approved Razorpay Linked Account ID in their profile');
    const transfers = recipients.map(a => ({
      account: accountByUser.get(a.recipientId), amount: a.amountPaise, currency: 'INR',
      notes: { groupId: String(groupId), recipientUserId: String(a.recipientId) }
    }));
    const receipt = `split_${Date.now()}_${req.user.userId}`.slice(0, 40);
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Authorization': 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: totalPaise, currency: 'INR', receipt, partial_payment: false, transfers })
    });
    const order = await response.json();
    if (!response.ok) { console.error('Razorpay order error:', order); return fail(res, 502, order.error?.description || 'Payment provider rejected the order'); }
    const payment = await prisma.payment.create({
      data: { groupId, senderId: req.user.userId, totalPaise, method: 'razorpay-route', status: 'pending', providerOrderId: order.id,
        allocations: { create: recipients } }
    });
    res.status(201).json({ success: true, paymentId: payment.id, orderId: order.id, amount: order.amount, currency: order.currency, keyId });
  } catch (e) { console.error(e); fail(res, 500, 'Could not create split-payment order'); }
});

app.post('/api/payments/verify', authenticateToken, async (req, res) => {
  try {
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (![orderId, paymentId, signature].every(v => typeof v === 'string' && v)) return fail(res, 400, 'Payment verification details are required');
    const payment = await prisma.payment.findFirst({ where: { providerOrderId: orderId, senderId: req.user.userId } });
    if (!payment) return fail(res, 404, 'Payment order not found');
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
    const a = Buffer.from(expected), b = Buffer.from(signature);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return fail(res, 400, 'Payment signature verification failed');
    const keyId = process.env.RAZORPAY_KEY_ID, keySecret = process.env.RAZORPAY_KEY_SECRET;
    const check = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { 'Authorization': 'Basic ' + Buffer.from(`${keyId}:${keySecret}`).toString('base64') }
    });
    const details = await check.json();
    if (!check.ok || details.order_id !== orderId || details.status !== 'captured' || details.amount !== payment.totalPaise) return fail(res, 409, 'Payment is not captured for the expected amount and order');
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'paid', reference: paymentId } });
    res.json({ success: true, message: 'Payment verified. Razorpay Route transfers will be processed by the provider.', paymentId });
  } catch (e) { console.error(e); fail(res, 500, 'Could not verify payment'); }
});

app.get('/api/groups/:id/chat', authenticateToken, async (req, res) => {
  try {
    const group = await groupForUser(req.params.id, req.user.userId);
    if (!group) return fail(res, 404, 'Group not found');
    const rows = await prisma.chatMessage.findMany({
      where: { groupId: group.id },
      include: { sender: { select: safeUser } },
      orderBy: { createdAt: 'asc' },
      take: 100
    });
    // One legacy message encrypted with an older key must not break the entire chat.
    const messages = rows.map(row => {
      let message;
      try { message = decrypt(row); }
      catch (error) {
        console.error(`CHAT DECRYPT ERROR (message ${row.id}):`, error.message);
        message = '[Older message cannot be decrypted with the current chat key]';
      }
      return { id: row.id, sender: row.sender, message, createdAt: row.createdAt };
    });
    res.json({ success: true, messages });
  } catch (error) {
    console.error('GET GROUP CHAT ERROR:', error);
    res.status(500).json({ success: false, message: `Unable to load group messages: ${error.message}` });
  }
});

app.post('/api/groups/:id/chat', authenticateToken, async (req, res) => {
  try {
    const group = await groupForUser(req.params.id, req.user.userId);
    if (!group) return fail(res, 404, 'Group not found');
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (!message || message.length > 1000) return fail(res, 400, 'Message must contain 1–1000 characters');
    const encrypted = encrypt(message);
    const row = await prisma.chatMessage.create({
      data: { groupId: group.id, senderId: req.user.userId, ...encrypted },
      include: { sender: { select: safeUser } }
    });
    res.status(201).json({ success: true, message: { id: row.id, sender: row.sender, message, createdAt: row.createdAt } });
  } catch (error) {
    console.error('POST GROUP CHAT ERROR:', error);
    res.status(500).json({ success: false, message: `Unable to send group message: ${error.message}` });
  }
});
app.post('/api/chatbot', authenticateToken, async (req, res) => {
  const question = String(req.body?.question || '').toLowerCase();
  const userId = req.user.userId;
  const myGroups = await prisma.group.findMany({ where: { members: { some: { userId } } }, select: { id: true, name: true } });
  if (!myGroups.length) return res.json({ success: true, answer: 'Create or join a group first. Then I can summarize your shared expenses.' });
  const ids = myGroups.map(g => g.id);
  const expenses = await prisma.expense.findMany({ where: { groupId: { in: ids } }, include: { splits: true } });
  const paid = expenses.filter(e => e.payerId === userId).reduce((s,e)=>s+e.amountPaise,0);
  const owed = expenses.reduce((s,e)=>s+(e.splits.find(x=>x.userId===userId)?.sharePaise||0),0);
  let answer = `Across your ${myGroups.length} group(s), you have paid ${((paid)/100).toFixed(2)} rupees in recorded expenses and your recorded shares total ${((owed)/100).toFixed(2)} rupees.`;
  if (question.includes('group')) answer = `Your groups: ${myGroups.map(g=>g.name).join(', ')}.`;
  else if (question.includes('owe') || question.includes('balance')) answer = `Your recorded expense shares are ₹${(owed/100).toFixed(2)} and you have paid ₹${(paid/100).toFixed(2)}. Open a group to see member-wise balances.`;
  else if (question.includes('paid') || question.includes('spend')) answer = `You have paid ₹${(paid/100).toFixed(2)} across your groups.`;
  res.json({ success: true, answer });
});

app.post('/api/payments', authenticateToken, async (req, res) => {
  const groupId = Number(req.body?.groupId), totalPaise = toPaise(req.body?.totalPaise ?? req.body?.amount, req.body?.totalPaise !== undefined);
  const group = await groupForUser(groupId, req.user.userId); if (!group) return fail(res, 404, 'Group not found');
  const raw = req.body?.allocations;
  if (!Number.isSafeInteger(totalPaise) || totalPaise <= 0 || !Array.isArray(raw) || !raw.length) return fail(res, 400, 'A positive total and at least one allocation are required');
  const allocations = raw.map(a => ({ recipientId: Number(a.recipientId), amountPaise: toPaise(a.amountPaise ?? a.amount, a.amountPaise !== undefined) }));
  if (allocations.some(a => !Number.isInteger(a.recipientId) || a.recipientId === req.user.userId || !group.members.some(m => m.userId === a.recipientId) || !Number.isSafeInteger(a.amountPaise) || a.amountPaise <= 0)) return fail(res, 400, 'Each allocation must be a positive amount for another group member');
  if (allocations.reduce((s, a) => s + a.amountPaise, 0) !== totalPaise) return fail(res, 400, 'Allocation amounts must add up to the exact payment total');
  const payment = await prisma.payment.create({ data: { groupId, senderId: req.user.userId, totalPaise, method: String(req.body?.method || 'recorded').slice(0, 40), reference: req.body?.reference ? String(req.body.reference).slice(0, 100) : null, allocations: { create: allocations } }, include: { allocations: { include: { recipient: { select: safeUser } } } } });
  res.status(201).json({ success: true, message: 'Payment allocations recorded', payment });
});
app.use((err, _req, res, _next) => { console.error(err); res.status(500).json({ success: false, message: 'Unexpected server error' }); });
app.use((_req, res) => fail(res, 404, 'Route not found'));

const server = app.listen(PORT, () => console.log(`Expense Tracker running at http://localhost:${PORT}`));
async function shutdown() { server.close(); await prisma.$disconnect(); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
module.exports = { app, prisma, splitEqually, toPaise };
