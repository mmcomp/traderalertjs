'use strict'

const { Model } = require('objection')
 
class CurrencyCache extends Model {
  static get tableName () {
    return 'currency_caches'
  }
}
 
module.exports = CurrencyCache