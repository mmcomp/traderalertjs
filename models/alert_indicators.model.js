'use strict'

const { Model } = require('objection')
const User = require('./users.model')
 
class AlertIndicator extends Model {
  static get tableName () {
    return 'alert_indicators'
  }
    
  $beforeInsert(context) {
    this.created_at = new Date().toISOString()
    this.updated_at = this.created_at
  }

  $beforeUpdate(context) {
    this.updated_at = new Date().toISOString()
  }

  static relationMappings = {
    user: {
      relation: Model.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: 'alert_indicators.users_id',
        to: 'users.id'
      }
    }
  }
}
 
module.exports = AlertIndicator