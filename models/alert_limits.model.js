'use strict'

// const BaseModel = require('./base.model')
const { Model } = require('objection')
const User = require('./users.model')
 
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

  static relationMappings = {
    user: {
      // relation: BaseModel.BelongsToOneRelation,
      relation: Model.BelongsToOneRelation,
      modelClass: User,
      join: {
        from: 'alert_limits.users_id',
        to: 'users.id'
      }
    }
  }
}
 
module.exports = AlertLimit