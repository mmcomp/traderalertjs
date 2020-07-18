'use strict'

const { Model } = require('objection')
 
class AlertIndicator extends Model {
  static get tableName () {
    return 'alert_indicators'
  }
}
 
module.exports = AlertIndicator