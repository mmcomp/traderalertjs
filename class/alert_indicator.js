'use strict'

const AlertIndicator = require('../models/alert_indicators.model')

class AlertIndicatorLogic {
    constructor (){
    }

    async init(){
        let now = `${new Date().getFullYear()}-${this.twoDigit(new Date().getMonth()+1)}-${this.twoDigit(new Date().getDate())}`
        this.alertIndicators = await AlertIndicator.query().where('expire_date', '>', now)
    }

    twoDigit(inp){
        let tmp = parseInt(inp, 10)
        if(isNaN(tmp) || (!isNaN(tmp) && tmp>=10))
            return inp
        return `0${tmp}`
    } 
}

module.exports = AlertIndicatorLogic