var util = require('util');

/**
 * Expose `Subscriptions`.
 */

module.exports = Subscriptions;

/**
 * A list of Stripe `subscriptions`.
 *
 * @param {Array|Customer} subscriptions
 *
 */

function Subscriptions (subscriptions) {
  this.subscriptions = subscriptions;
}

/**
 * Return a new active `Subscriptions` list thats filtered by `start` and `end`.
 *
 * @param {Date} start
 * @param {Date} end
 * @return {Subscriptions}
 */

Subscriptions.prototype.active = function (start, end) {
  return this.started(start, end).status('active');
};

/**
 * Return a new active `Subscriptions` list thats filtered by `start` and `end`.
 *
 * @param {Date} start
 * @param {Date} end
 * @return {Subscriptions}
 */

Subscriptions.prototype.trialing = function (start, end) {
  return this.started(start, end).status('trialing');
};

/**
 * Return a new `Subscriptions` list thats filtered by `start` and `end`.
 *
 * @param {Date} start
 * @param {Date} end
 * @return {Subscriptions}
 */

Subscriptions.prototype.started = function (start, end) {
  if (!util.isDate(start)) return this;
  if (!util.isDate(end)) end = new Date('1/1/99999');
  var s = start.getTime(), e = end.getTime();
  return new Subscriptions(this.subscriptions.filter(function (subscription) {
    if (subscription.status !== 'active') return false;
    var started = subscription.start * 1000;
    return started >= s && started <= e;
  }));
};

/**
 * Return a new `Subscriptions` list thats filtered by `status`.
 *
 * @param {String} status
 * @return {Subscriptions}
 */

Subscriptions.prototype.status = function (status) {
  return new Subscriptions(this.subscriptions.filter(function (subscription) {
    return subscription.status === status;
  }));
};

/**
 * Return a new `Subscriptions` list thats filtered by `planId`.
 *
 * @param {String} planId
 * @return {Subscriptions}
 */

Subscriptions.prototype.plan = function (planId) {
  return new Subscriptions(this.subscriptions.filter(function (subscription) {
    return subscription.plan.id === planId;
  }));
};

/**
 * Return a new `Subscriptions` list thats filtered without
 * plans with `planId`.
 *
 * @param {String} planId
 * @return {Subscriptions}
 */

Subscriptions.prototype.withoutPlan = function (planId) {
  return new Subscriptions(this.subscriptions.filter(function (subscription) {
    return subscription.plan.id !== planId;
  }));
};

/**
 * Return a new `Subscriptions` list thats has plans that cost more
 * or equal to `amount`.
 *
 * @param {Number} amount
 * @return {Subscriptions}
 */

Subscriptions.prototype.paid = function (amount) {
  if (!amount) amount = 1;
  return new Subscriptions(this.subscriptions.filter(function (subscription) {
    return subscription.plan.amount >= amount;
  }));
};

/**
 * Count the subscriptions between `start` and `end`.
 *
 * @param {Date} start
 * @param {Date} end
 * @return {Number}
 */

Subscriptions.prototype.list = function (start, end) {
  return this.started(start, end).subscriptions;
};

/**
 * Count the subscriptions between `start` and `end`.
 *
 * @param {Date} start
 * @param {Date} end
 * @return {Number}
 */

Subscriptions.prototype.count = function (start, end) {
  return this.started(start, end).subscriptions.length;
};

/**
 * Print an audit of the subscriptions.
 *
 * @return {Number}
 */

Subscriptions.prototype.print = function () {
  var list = this.list();
  var total = 0;
  for (var i = 0; i < list.length; i += 1) {
    var s = list[i];
    var c = s.customer;
    var a = Math.round(amount(s) * 100) / 100.0;
    console.log([c.email, s.status, s.plan.name, '$' + a].join(' - '));
    total += a;
  }
  console.log('Total MRR: $' + total);
};

/**
 * Count the monthly recurring revenue of subscriptions in that period.
 *
 * @param {Date} start
 * @param {Date} end
 * @return {Number}
 */

Subscriptions.prototype.mrr = function (start, end) {
  var mrr = this.started(start, end).subscriptions.reduce(function (memo, subscription) {
    return memo + amountMrr(subscription);
  }, 0.00);

  return Math.round(mrr * 100) / 100.0; // to two decimal points
};

/**
 * Calculate the amount in dollars of a subscription after fees
 * and discounts.
 *
 * @param {Subscription} subscription
 * @return {Number}
 */

function amountMrr (subscription) {
  var res = (subscription.plan.amount / 100.0);
  res = normalizeMonths(subscription, res);
  if (res > 0.0) {
    var discount = subscription.customer.discount;
    if (discount && discount.coupon) {
      var coupon = discount.coupon;
      if (coupon.valid) {
        if (coupon.amount_off) res -= (coupon.amount_off / 100.0);
        else if (coupon.percent_off) res *= (1.00 - (coupon.percent_off / 100.0));
      }
    }
    res *= (1.00 - 0.029); // Stripe fees
  }
  return res;
}

//
function normalizeMonths (subscription, res) {
  var interval = subscription.plan.interval;
  var count = subscription.plan.interval_count;
  if (interval === 'day')
    res *= 30 / count;
  else if (interval === 'week')
    res *= 4 / count;
  else if (interval === 'month')
    res *= 1 / count;
  else if (interval === 'year'){
    res = res / 12 / count;
  }
  else
    throw new Error('Unexpected interval ' + interval);
  return res;
}
