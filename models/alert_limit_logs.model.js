'use strict'

const { Model } = require('objection')
const User = require('./users.model')
const AlertLimit = require('./alert_limits.model')
 
class AlertLimitLog extends Model {
  static get tableName () {
    return 'alert_limit_logs'
  }
  
  $beforeInsert(context) {
    this.created_at = new Date().toISOString()
    this.updated_at = this.created_at
  }

  $beforeUpdate(context) {
    this.updated_at = new Date().toISOString()
  }

  static async logAlertLimit(alertLimit){
    alertLimit.alert_limits_id = alertLimit.id
    delete alertLimit.id
    return await AlertLimitLog.query().insert(alertLimit)
  }

  static relationMappings = {
    user: {
      relation: Model.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: 'alert_limit_logs.users_id',
        to: 'users.id'
      }
    },
    alertLimit: {
      relation: Model.BelongsToOneRelation,
      modelClass: AlertLimit,
      join: {
        from: 'alert_limit_logs.alert_limits_id',
        to: 'alert_limits.id'
      }
    }
  }
}
 
module.exports = AlertLimitLog