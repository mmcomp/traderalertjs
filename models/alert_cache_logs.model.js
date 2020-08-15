'use strict'

const { Model } = require('objection')
 
class AlertCacheLog extends Model {
  static get tableName () {
    return 'alert_cache_logs'
  }
    
  $beforeInsert(context) {
    this.created_at = new Date().toISOString()
    this.updated_at = this.created_at
  }

  $beforeUpdate(context) {
    this.updated_at = new Date().toISOString()
  }

  static async logAlertCache(alertCache){
    alertCache.alert_caches_id = alertCache.id
    alertCache.result = (alertCache.result)?JSON.stringify(alertCache.result):alertCache.result
    delete alertCache.id
    return await AlertCacheLog.query().insert(alertCache)
  }
}
 
module.exports = AlertCacheLog