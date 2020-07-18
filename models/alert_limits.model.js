'use strict'

const { Model } = require('objection')
 
class AlertLimit extends Model {
  static get tableName () {
    return 'alert_limits'
  }
  
  $beforeInsert(context) {
    this.created_at = new Date().toISOString()
    this.updated_at = this.created_at
  }

  $beforeUpdate(context) {
    this.updated_at = new Date().toISOString()
  }
}
 
module.exports = AlertLimit