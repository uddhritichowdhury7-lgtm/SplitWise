const express = require('express');
const router = express.Router();

module.exports = (prisma, authenticateToken) => {
  router.use(authenticateToken);

  const validMonth = (value) => /^\d{4}-\d{2}$/.test(value || '');
  const monthRange = (month) => {
    const [year, m] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, m - 1, 1));
    const end = new Date(Date.UTC(year, m, 1));
    return { gte: start, lt: end };
  };

  router.get('/summary', async (req, res) => {
    try {
      const month = String(req.query.month || new Date().toISOString().slice(0, 7));
      if (!validMonth(month)) return res.status(400).json({ success: false, message: 'Month must be YYYY-MM' });
      const where = { userId: req.user.userId, date: monthRange(month) };
      const [transactions, budgets] = await Promise.all([
        prisma.personalTransaction.findMany({ where, orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] }),
        prisma.personalBudget.findMany({ where: { userId: req.user.userId, month } })
      ]);
      const incomePaise = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amountPaise, 0);
      const expensePaise = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amountPaise, 0);
      const savingsPaise = budgets.find(b => b.category === 'Savings')?.limitPaise || 0;
      const fixedPaise = budgets.filter(b => b.category !== 'Savings').reduce((s, b) => s + b.limitPaise, 0);
      const remainingBudgetReservePaise = budgets.filter(b => b.category !== 'Savings').reduce((sum, b) => {
        const spent = transactions.filter(t => t.type === 'expense' && t.category === b.category).reduce((n, t) => n + t.amountPaise, 0);
        return sum + Math.max(0, b.limitPaise - spent);
      }, 0);
      const shopping = budgets.find(b => b.category === 'Shopping');
      const shoppingSpent = transactions.filter(t => t.type === 'expense' && t.category === 'Shopping').reduce((s, t) => s + t.amountPaise, 0);
      const categorySummary = budgets.map(b => ({
        id: b.id, category: b.category, limitPaise: b.limitPaise,
        spentPaise: transactions.filter(t => t.type === 'expense' && t.category === b.category).reduce((s, t) => s + t.amountPaise, 0)
      }));
      res.json({ success: true, month, transactions, budgets: categorySummary,
        totals: { incomePaise, expensePaise, savingsPaise, fixedPaise,
          reservedBudgetPaise: remainingBudgetReservePaise,
          availablePaise: Math.max(0, incomePaise - expensePaise - savingsPaise - remainingBudgetReservePaise),
          shoppingRemainingPaise: shopping ? Math.max(0, shopping.limitPaise - shoppingSpent) : null }
      });
    } catch (error) { console.error('PERSONAL SUMMARY ERROR:', error); res.status(500).json({ success: false, message: 'Could not load personal finance summary' }); }
  });

  router.post('/transactions', async (req, res) => {
    try {
      const { title, type, category, amount, date } = req.body || {};
      const amountPaise = Math.round(Number(amount) * 100);
      const allowed = ['Salary', 'Other Income', 'Rent', 'Utilities', 'Groceries', 'Shopping', 'Transport', 'Entertainment', 'Health', 'Other'];
      if (typeof title !== 'string' || !title.trim() || !['income', 'expense'].includes(type) || !allowed.includes(category) || !Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
        return res.status(400).json({ success: false, message: 'Enter a title, valid type, category and positive amount' });
      }
      const transactionDate = date ? new Date(`${date}T12:00:00.000Z`) : new Date();
      if (Number.isNaN(transactionDate.getTime())) return res.status(400).json({ success: false, message: 'Invalid date' });
      const transaction = await prisma.personalTransaction.create({ data: { userId: req.user.userId, title: title.trim().slice(0, 100), type, category, amountPaise, date: transactionDate } });
      res.status(201).json({ success: true, transaction });
    } catch (error) { console.error('PERSONAL TRANSACTION ERROR:', error); res.status(500).json({ success: false, message: 'Could not save transaction' }); }
  });

  router.post('/budgets', async (req, res) => {
    try {
      const { month, category, amount } = req.body || {};
      const limitPaise = Math.round(Number(amount) * 100);
      const allowed = ['Savings', 'Rent', 'Utilities', 'Groceries', 'Shopping', 'Transport', 'Entertainment', 'Health', 'Other'];
      if (!validMonth(month) || !allowed.includes(category) || !Number.isSafeInteger(limitPaise) || limitPaise < 0) {
        return res.status(400).json({ success: false, message: 'Enter a valid month, category and non-negative amount' });
      }
      const budget = await prisma.personalBudget.upsert({
        where: { userId_month_category: { userId: req.user.userId, month, category } },
        update: { limitPaise }, create: { userId: req.user.userId, month, category, limitPaise }
      });
      res.json({ success: true, budget });
    } catch (error) { console.error('PERSONAL BUDGET ERROR:', error); res.status(500).json({ success: false, message: 'Could not save budget' }); }
  });

  router.delete('/transactions/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const result = await prisma.personalTransaction.deleteMany({ where: { id, userId: req.user.userId } });
      if (!result.count) return res.status(404).json({ success: false, message: 'Transaction not found' });
      res.json({ success: true });
    } catch (error) { console.error('DELETE PERSONAL TRANSACTION ERROR:', error); res.status(500).json({ success: false, message: 'Could not delete transaction' }); }
  });

  return router;
};
