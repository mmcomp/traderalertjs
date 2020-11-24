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

  $parseDatabaseJson(json) {
    json = super.$parseDatabaseJson(json);
    json.created_at = json.created_at && new Date(json.created_at);
    json.updated_at = json.updated_at && new Date(json.updated_at);
    return json;
  }

  static async logAlertCache(alertCache){
    // console.log('Adding Alert Cache', alertCache)
    if(typeof alertCache.id== 'undefined' && typeof alertCache.alert_caches_id== 'undefined')
      return null;
    if(typeof alertCache.id!= 'undefined'){
      alertCache.alert_caches_id = alertCache.id
      delete alertCache.id
    }
    alertCache.result = (alertCache.result)?JSON.stringify(alertCache.result):alertCache.result
    // console.log('Adding Alert Cache', alertCache)
    return await AlertCacheLog.query().insert(alertCache)
  }
}
 
module.exports = AlertCacheLog