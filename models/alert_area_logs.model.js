'use strict'

const { Model } = require('objection')
const User = require('./users.model')
 
class AlertAreaLog extends Model {
  static get tableName () {
    return 'alert_area_logs'
  }
  
  $beforeInsert(context) {
    this.created_at = new Date().toISOString()
    this.updated_at = this.created_at
  }

  $beforeUpdate(context) {
    this.updated_at = new Date().toISOString()
  }

  static async logAlertArea(alertArea){
    alertArea.alert_areas_id = alertArea.id
    delete alertArea.id
    return await AlertAreaLog.query().insert(alertArea)
  }

  static relationMappings = {
    user: {
      relation: Model.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: 'alert_area_logs.users_id',
        to: 'users.id'
      }
    }
  }
}
 
module.exports = AlertAreaLog