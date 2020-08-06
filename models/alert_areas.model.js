'use strict'

const { Model } = require('objection')
const User = require('./users.model')
 
class AlertArea extends Model {
  static get tableName () {
    return 'alert_areas'
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
        from: 'alert_areas.users_id',
        to: 'users.id'
      }
    }
  }
}
 
module.exports = AlertArea