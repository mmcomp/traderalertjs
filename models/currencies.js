'use strict'

const { Model } = require('objection')
 
class Currency extends Model {
  static get tableName () {
    return 'currencies'
  }

  $beforeInsert(context) {
    this.created_at = new Date().toISOString()
    this.updated_at = this.created_at
  }

  $beforeUpdate(context) {
    this.updated_at = new Date().toISOString()
  }
}
 
module.exports = Currency