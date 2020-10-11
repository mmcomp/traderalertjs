'use strict'

const AlertIndicator = require('../models/alert_indicators.model')
const AlertCache = require('../models/alert_caches.model')
const AlertCacheLog = require('../models/alert_cache_logs.model')
const Currency = require('../models/currencies.model')
const BinanceReaderClass = require('./binance')
const fs = require('fs')
const { exec } = require("child_process")
const { val } = require('objection')

class TaapiReaderClass {
    constructor (client){
        this.client = client
    }

    async getIndicator(indicator, source, symbol, interval, params, backtrack) {
        source = (source.indexOf("binance")>=0)?"binance":source
        let client = this.client
        return new Promise(async function(resolve, reject){
            try{
                let result = await client.getIndicator(indicator, source, symbol, interval)
                resolve(result)
            }catch(e){
                reject(e)
            }
        })
    }

    async readAlerts() {
        const alerts = await AlertCache.query().where('type', 'indicator')
        var indx = 1
        for(var alert of alerts) {
            console.log(` - Start reading an alert from Tapi ${indx} ....`)
            await this.readAlert(alert)
            await new Promise(r => setTimeout(r, parseInt(process.env.TAAPI_REQUEST_INTERVAL, 10)));
            indx++
        }
    }
    
    async readAlert(alert) {
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
            console.log('Result', result)
            alert.result = result
            const alertCacheLog = await AlertCacheLog.query().where('alert_caches_id', alert.id).first()
            if(alertCacheLog){
                try{
                    alertCacheLog.result = JSON.parse(alertCacheLog.result)
                }catch(e){
                    alertCacheLog.result = null
                }
                const timeDiff = (new Date() - new Date(alertCacheLog.created_at)) / 60000
                // console.log(alertCacheLog.id, new Date(), alertCacheLog.created_at, new Date(alertCacheLog.created_at))
                console.log('TimeDef', timeDiff)
                // return false
                if(timeDiff < parseInt(process.env.ALERT_LIFETIME_MINUTES, 10))
                    return false
            }
            
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
            this.sendAlert(alerts, alertCacheLog, alert)
        }catch(e){
            console.log('indicator Error:', e)
        }
    }

    compareWithTolerance(value, base, tolerance) {
        return ((value <= base + tolerance) && (value >= base - tolerance))
    }

    rsiVerfy(alert, alertCacheLog, result) {
        const INDICATOR_MAX = parseInt(process.env.INDICATOR_MAX, 10)
        const INDICATOR_MIN = parseInt(process.env.INDICATOR_MIN, 10)
        const INDICATOR_TOLERANCE = parseInt(process.env.INDICATOR_TOLERANCE, 10)
        const pastValue = alertCacheLog.result.value
        const currentValue = result.value
        console.log('RSI : checking from ', pastValue, 'to', currentValue)
        var res = false
        if((pastValue<(INDICATOR_MAX-INDICATOR_TOLERANCE)) && (currentValue>=INDICATOR_MAX))
            res = true
        else if((pastValue>(INDICATOR_MIN+INDICATOR_TOLERANCE)) && (currentValue<=INDICATOR_MIN))
            res = true
        console.log('result', res)
        return res
    }

    bbandsVerfy(price, oldPrice, result) {
        if(oldPrice < result.valueUpperBand && price >=result.valueUpperBand)
            return true
        if(oldPrice > result.valueLowerBand && price <=result.valueLowerBand)
            return true
        return false
    }

    async sendAlert(alerts, alertCacheLog, alertCache) {
        const result = alertCache.result
        for(const alert of alerts) {
            if(alert.user.telegram_id) {
                console.log('Alert of ', alert.indicator)
                const {currentDate, currentTime} = BinanceReaderClass.nowDate()
                if(alert.indicator=='rsi') {
                    if(alertCacheLog) 
                    {
                        if(this.rsiVerfy(alert, alertCacheLog, result)) {
                            let msg = `♦️ ${alert.currency.replace('/', ' / ')} 
        
⚠️ Indicator Alert RSI

🔊 ${alert.indicator} [${alert.timeframe}]

💰 Current Value: ${result.value}

🕑 ${currentDate} ${currentTime}`
                            this.sendMessage(alert, msg, AlertIndicator)
                        }
                        const INDICATOR_MAX = parseInt(process.env.INDICATOR_MAX, 10)
                        const INDICATOR_MIN = parseInt(process.env.INDICATOR_MIN, 10)
                        const INDICATOR_TOLERANCE = parseInt(process.env.INDICATOR_TOLERANCE, 10)
                        const pastValue = alertCacheLog.result.value
                        const currentValue = result.value
                        if( currentValue<(INDICATOR_MIN - INDICATOR_TOLERANCE) || currentValue>(INDICATOR_MAX+INDICATOR_TOLERANCE) || 
                            (currentValue>(INDICATOR_MIN+INDICATOR_TOLERANCE) && currentValue<(INDICATOR_MAX - INDICATOR_TOLERANCE)) ||
                            (pastValue > (INDICATOR_MIN+INDICATOR_TOLERANCE) && currentValue <= INDICATOR_MIN) ||
                            (pastValue < (INDICATOR_MAX-INDICATOR_TOLERANCE) && currentValue >= INDICATOR_MAX)
                        )
                            AlertCacheLog.query().where('id', alertCacheLog.id).delete().then(res => {
                                AlertCacheLog.logAlertCache(alertCache)
                            }).catch()
                    }
                    else
                        AlertCacheLog.logAlertCache(alertCache).then().catch()
                } else if(alert.indicator=='macd') {
                    let msg = `♦️ ${alert.currency.replace('/', ' / ')} 
    
⚠️ Indicator Alert MACD

🔊 ${alert.indicator} [${alert.timeframe}]

💰 Current Value:  MACD = ${result.valueMACD}, MACDSignal = ${result.valueMACDSignal}, MACDHist = ${result.valueMACDHist}

🕑 ${currentDate} ${currentTime}`
                    if(alertCacheLog && alertCacheLog.result && result.valueMACDHist!=0 && alertCacheLog.result.valueMACDHist!=0){
                        const currentPol = Math.abs(result.valueMACDHist)/result.valueMACDHist
                        const pastPol = Math.abs(alertCacheLog.result.valueMACDHist)/alertCacheLog.result.valueMACDHist
                        if(currentPol!=pastPol)
                            this.sendMessage(alert, msg, AlertIndicator)
                    }else
                        this.sendMessage(alert, msg, AlertIndicator)

                    AlertCacheLog.query().where('id', alertCacheLog.id).delete().then(res => {
                        AlertCacheLog.logAlertCache(alertCache)
                    }).catch()
                } else if(alert.indicator=='bbands' || alert.indicator=='bbands2') {
                    console.log('BBand found')
                    const currencyObject = await Currency.query().where('name', alert.currency).first()
                    console.log('Current Value', currencyObject)
                    if(currencyObject && alertCacheLog) {
                        const price = currencyObject.price
                        let msg = `♦️ ${alert.currency.replace('/', ' / ')} 
    
⚠️ Indicator Alert Boilinger Band

🔊 ${alert.indicator} [${alert.timeframe}]

💰 Current Value:  UpperBand = ${result.valueUpperBand}, MiddleBand = ${result.valueMiddleBand}, LowerBand = ${result.valueLowerBand}, CurrenctPrice = ${price}

🕑 ${currentDate} ${currentTime}`

                        if(this.bbandsVerfy(price, alertCacheLog.result, result))
                            this.sendMessage(alert, msg, AlertIndicator)

                        AlertCacheLog.query().where('id', alertCacheLog.id).delete().then(res => {
                            AlertCacheLog.logAlertCache(alertCache)
                        }).catch()
                    }else
                        AlertCacheLog.logAlertCache(alertCache).then(res=>{
                            console.log('add res', res)
                        }).catch()
                }
            }
        }

    }

    async sendMessage(alert, msg, alertClass) {
        console.log('Sending Telegram MSG to ', alert.user.telegram_id)
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