'use strict'

const AlertIndicator = require('../models/alert_indicators.model')
const AlertCache = require('../models/alert_caches.model')
const AlertCacheLog = require('../models/alert_cache_logs.model')
const BinanceReaderClass = require('./binance')
const fs = require('fs')
const { exec } = require("child_process")

class TaapiReaderClass {
    constructor (client){
        this.client = client
    }

    async getIndicator(indicator, source, symbol, interval, params, backtrack) {
        let client = this.client
        return new Promise(async function(resolve, reject){
            try{
                let result = await client.getIndicator(indicator, source, symbol, interval, params, backtrack)
                // console.log("Result: ", result)
                resolve(result)
            }catch(e){
                reject(e)
            }
        })
    }

    async readAlerts() {
        const alerts = await AlertCache.query().where('type', 'indicator')
        console.log('Indicator Alerts', alerts)
        for(var alert of alerts) {
            this.readAlert(alert)
        }
    }
    
    async readAlert(alert) {
        console.log('Read Alert', alert)
        try{
            var result = {}
            const cachePath = process.env.CACHE_PATH + 'Tapi_getIndicator.json'
            if(process.env.IS_TEST!='false' && fs.existsSync(cachePath))
                result = JSON.parse(fs.readFileSync(cachePath))
            else{
                result = await this.getIndicator(alert.indicator, alert.exchange, alert.currency, alert.timeframe.toLowerCase())
                if(process.env.IS_TEST!='false'){
                    const dataToStore = JSON.stringify(result)
                    fs.writeFileSync(cachePath,  dataToStore)
                }
            }
            console.log('indicator result:', result)
            alert.result = result
            const alertCacheLog = await AlertCacheLog.query().where('alert_caches_id', alert.id).first()
            if(alertCacheLog){
                try{
                    alertCacheLog.result = JSON.parse(alertCacheLog.result)
                }catch(e){
                    alertCacheLog.result = null
                }
            }
            console.log('alertCacheLog', alertCacheLog)
            
            const {currentDate, currentTime} = BinanceReaderClass.nowDate()
            const alerts = await AlertIndicator.query().withGraphFetched('user')
                .where('sent', false)
                .where(function(query) {
                    query.where('expire_date', '>', currentDate).orWhere('expire_date', null).orWhere('expire_date', '').orWhere('expire_date', '0000-00-00 00:00:00')
                })
                .where('currency', alert.currency)
                .where('exchange', alert.exchange)
                .where('indicator', alert.indicator)
                .where('timeframe', alert.timeframe)
            console.log('Must send to ', alerts)
            this.sendAlert(alerts, alertCacheLog, alert)
        }catch(e){
            console.log('indicator Error:', e)
        }
    }

    rsiVerfy(alert, alertCacheLog, result) {
        return (
            alert.indicator=='rsi' && 
            (

                (!alertCacheLog) && (
                    (
                        (result.value >= process.env.INDICATOR_MAX - process.env.INDICATOR_TOLERANCE) && (result.value <= process.env.INDICATOR_MAX + process.env.INDICATOR_TOLERANCE)
                    ) || 
                    (
                        (result.value >= process.env.INDICATOR_MIN - process.env.INDICATOR_TOLERANCE) && (result.value <= process.env.INDICATOR_MIN + process.env.INDICATOR_TOLERANCE)
                    )
                )

            ) ||
            (
                (alertCacheLog) && (
                    (
                        (result.value >= process.env.INDICATOR_MAX - process.env.INDICATOR_TOLERANCE) && (result.value <= process.env.INDICATOR_MAX + process.env.INDICATOR_TOLERANCE) &&
                        (alertCacheLog.result.value < process.env.INDICATOR_MAX - process.env.INDICATOR_TOLERANCE)
                    ) ||
                    (
                        (result.value >= process.env.INDICATOR_MIN - process.env.INDICATOR_TOLERANCE) && (result.value <= process.env.INDICATOR_MIN + process.env.INDICATOR_TOLERANCE) &&
                        (alertCacheLog.result.value > process.env.INDICATOR_MIN + process.env.INDICATOR_TOLERANCE)
                    )
                )
            )
        )
    }

    async sendAlert(alerts, alertCacheLog, alertCache) {
        console.log('Sending TAPI!', alertCache, alertCacheLog)
        const result = alertCache.result
        for(const alert of alerts) {
            if(alert.user.telegram_id) {
                const {currentDate, currentTime} = BinanceReaderClass.nowDate()
                if(rsiVerfy(alert, alertCacheLog, result)) {
                    let msg = `♦️ ${alert.currency.replace('/', ' / ')} 
    
⚠️ Indicator Alert RSI

🔊 ${alert.indicator} [${alert.timeframe}]

💰 Current Value: ${result.value}

🕑 ${currentDate} ${currentTime}`
                    this.sendMessage(alert, msg, AlertIndicator)
                    if(alertCache.result.value==process.env.INDICATOR_MAX || alertCache.result.value==process.env.INDICATOR_MIN ) {
                        if(alertCacheLog) 
                            AlertCacheLog.query().where('id', alertCacheLog.id).delete().then(res => {
                                AlertCacheLog.logAlertCache(alertCache)
                            }).catch()
                        else
                            AlertCacheLog.logAlertCache(alertCache).then().catch()
                    }
                } else if(alert.indicator=='macd' && alertCacheLog && ((result.valueMACDHist>0 && alertCacheLog.result.valueMACDHist<0) || (result.valueMACDHist<0 && alertCacheLog.result.valueMACDHist>0))) {
                    let msg = `♦️ ${alert.currency.replace('/', ' / ')} 
    
⚠️ Indicator Alert MACD

🔊 ${alert.indicator} [${alert.timeframe}]

💰 Current Value:  MACD = ${result.valueMACD}, MACDSignal = ${result.valueMACDSignal}, MACDHist = ${result.valueMACDHist}

🕑 ${currentDate} ${currentTime}`
                    this.sendMessage(alert, msg, AlertIndicator)
                    if(alertCacheLog) 
                        AlertCacheLog.query().where('id', alertCacheLog.id).delete().then(res => {
                            AlertCacheLog.logAlertCache(alertCache)
                        }).catch()
                    else
                        AlertCacheLog.logAlertCache(alertCache).then().catch()
                }
            }
        }

    }

    async sendMessage(alert, msg, alertClass) {
        console.log('Telegram Send!')
        return new Promise(function(resolve, reject){
            exec(`${process.env.BASE_COMMAND} "${msg}" --chat_id=${alert.user.telegram_id}`, (error, stdout, stderr) => {
                if (error) {
                    console.log(`error: ${error.message}`);
                    reject()
                    return
                }
                if (stderr) {
                    console.log(`stderr: ${stderr}`);
                    reject()
                    return
                }
                console.log(`stdout: ${stdout}`);
                if(alert.notification=='single')
                    alertClass.query().where('id', alert.id).update({
                        sent: true
                    }).then().catch()
                resolve()
            });
        })
    }
}


module.exports = TaapiReaderClass