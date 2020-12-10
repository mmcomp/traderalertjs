'use strict'

const AlertIndicator = require('../models/alert_indicators.model')
const AlertCache = require('../models/alert_caches.model')
const AlertCacheLog = require('../models/alert_cache_logs.model')
const Currency = require('../models/currencies.model');
const BBandLog = require('../models/bband_log.model');
const FiboLog = require('../models/fibo_log.model');
const BinanceReaderClass = require('./binance');
const fs = require('fs')
const { exec } = require("child_process")
const { val } = require('objection')

class TaapiReaderClass {
    constructor (client){
        this.client = client
    }

    static fixCurrency(inp) {
        if(inp.indexOf('/')>0)
            return inp;

        let baseCurrencies = ["BTC","USDT","ETH","BNB","PAX","USDC","TUSD","XRP","RUB","EUR","BUSD","ZAR","BKRW","IDRT","UAH","BIDR","DAI","AUD","GBP"];
        try{
            baseCurrencies = JSON.parse(process.env.BASE_CURRENCIES);
        }catch(e){}

        for(var baseCurrency of baseCurrencies) {
            if(inp.indexOf(baseCurrency)>0) {
                var toStr = `/${baseCurrency}`;
                return inp.replace(baseCurrency, toStr);
            }
        }

        return inp;
    }

    async getIndicator(indicator, source, symbol, interval, params, backtrack) {
        source = (source.indexOf("binance")>=0)?"binance":source
        let client = this.client
        if(!params && indicator=='bbands') {
            params = {
                optlnTimePeriod : 20
            };
        }
        return new Promise(async function(resolve, reject){
            try{
                let result = await client.getIndicator(indicator, source, symbol, interval, params)
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
            console.log(` - Start reading an alert from Tapi ${indx} of ${alerts.length} ....`)
            await this.readAlert(alert)
            await new Promise(r => setTimeout(r, parseInt(process.env.TAAPI_REQUEST_INTERVAL, 10)));
            indx++
        }
    }
    
    async readAlert(alert) {
        // console.log('Currency', alert.currency, alert.indicator, alert.timeframe.toLowerCase());
        var result = {}
        const cachePath = process.env.CACHE_PATH + 'Tapi_getIndicator.json'
        if(process.env.IS_TEST!='false' && fs.existsSync(cachePath))
            result = JSON.parse(fs.readFileSync(cachePath))
        else{
            // alert.currency = TaapiReaderClass.fixCurrency(alert.currency);
            try{
                result = await this.getIndicator(alert.indicator, alert.exchange, TaapiReaderClass.fixCurrency(alert.currency), alert.timeframe.toLowerCase())
            }catch(e){
                console.log('indicator Error:', e)
            }
            if(process.env.IS_TEST!='false'){
                const dataToStore = JSON.stringify(result)
                fs.writeFileSync(cachePath,  dataToStore)
            }
        }
        //console.log('Result', result)
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
            // console.log('TimeDef', timeDiff)
            // return false
            if(timeDiff < parseInt(process.env.ALERT_LIFETIME_MINUTES, 10))
                return false
        }
        
        const {currentDate, currentTime} = BinanceReaderClass.nowDate()
        try{
            const alerts = await AlertIndicator.query().withGraphFetched('user')
                .where('sent', false)
                .where(function(query) {
                    query.where('expire_date', '>', currentDate).orWhere('expire_date', null).orWhere('expire_date', '').orWhere('expire_date', '0000-00-00 00:00:00')
                })
                .where('currency', alert.currency)
                .where('exchange', alert.exchange)
                .where('indicator', alert.indicator)
                .where('timeframe', alert.timeframe)
        }catch(e) {
            console.log('E', e)
        }

        // console.log('Sending Alert')
        return;
        this.sendAlert(alerts, alertCacheLog, alert)
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
        // console.log('RSI : checking from ', pastValue, 'to', currentValue)
        var res = false
        if((pastValue<(INDICATOR_MAX-INDICATOR_TOLERANCE)) && (currentValue>=INDICATOR_MAX))
            res = true
        else if((pastValue>(INDICATOR_MIN+INDICATOR_TOLERANCE)) && (currentValue<=INDICATOR_MIN))
            res = true
        // console.log('result', res)
        return res
    }

    bbandsVerfy(price, oldPrice, result) {
        if(oldPrice < result.valueUpperBand && price >=result.valueUpperBand)
            return 'Sell'
        if(oldPrice > result.valueLowerBand && price <=result.valueLowerBand)
            return 'Buy'
        return false
    }

    fiboVerfy(price, oldPrice, result) {
        // console.log('Fibo test', price, oldPrice, result)
        if(oldPrice < result.value && price >=result.value)
            return true
        if(oldPrice > result.value && price <=result.value)
            return true
        return false
    }

    twoDecimals(num) {
        if(num>=1)
            return (Math.round(num * 100) / 100).toFixed(2);
        
        let noneZeroLocation;
        let tmpNum = num;
        let levelCount = 0;
        while(!noneZeroLocation) {
            tmpNum *= 10;
            if(tmpNum>=1)
                noneZeroLocation = levelCount;
            levelCount++;
        }
        let res = (Math.round(tmpNum * 10) / 100).toFixed(2);
        res = res /(Math.pow(10 , levelCount-1));
        return res;
    }

    async sendAlert(alerts, alertCacheLog, alertCache) {
        // console.log('Really sending!', alerts, alertCacheLog, alertCache)
        const result = alertCache.result
        for(const alert of alerts) {
            if(alert.user.telegram_id) {
                const {currentDate, currentTime} = BinanceReaderClass.nowDate()
                if(alert.indicator=='rsi') {
                    if(alertCacheLog) 
                    {
                        if(this.rsiVerfy(alert, alertCacheLog, result)) {
                            let action = `➡️ Cross Action`;
                            if(result.value<20)
                                action = `↗️ Buy Action`;
                            else if(result.value>80)
                                action = `↘️ Sell Action`;
                            let msg = `♦️ ${alert.currency.replace('/', ' / ')} 
⚠️ Indicator Alert RSI
🔊 ${alert.indicator} [${alert.timeframe}]
${action}
💰 Value: ${this.twoDecimals(result.value)}
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
                    // console.log('it is macd!', result)
                    let action = `➡️ Cross Action`;
                    if(result.valueMACDHist>0)
                        action = `↗️ Buy Action`;
                    else
                        action = `↘️ Sell Action`;
                    let msg = `♦️ ${alert.currency.replace('/', ' / ')} 
⚠️ Indicator Alert MACD
🔊 ${alert.indicator} [${alert.timeframe}]
${action}
💰 Value:  MACD = ${this.twoDecimals(result.valueMACD)}, MACDSignal = ${this.twoDecimals(result.valueMACDSignal)}, MACDHist = ${this.twoDecimals(result.valueMACDHist)}
🕑 ${currentDate} ${currentTime}`
                    if(alertCacheLog && alertCacheLog.result && result.valueMACDHist!=0 && alertCacheLog.result.valueMACDHist!=0){
                        const currentPol = Math.abs(result.valueMACDHist)/result.valueMACDHist
                        const pastPol = Math.abs(alertCacheLog.result.valueMACDHist)/alertCacheLog.result.valueMACDHist
                        if(currentPol!=pastPol)
                            this.sendMessage(alert, msg, AlertIndicator)
                    }/*else
                        this.sendMessage(alert, msg, AlertIndicator)*/
                    if(result.valueMACD){
                        if(alertCacheLog){
                            AlertCacheLog.query().where('id', alertCacheLog.id).delete().then(res => {
                                AlertCacheLog.logAlertCache(alertCache)
                            }).catch()
                        }else {
                            AlertCacheLog.logAlertCache(alertCache).then().catch()
                        }
                    }

                } else if(alert.indicator=='bbands' || alert.indicator=='bbands2') {
                    // console.log('BBand found')
                    const currencyObject = await Currency.query().where('name', alert.currency).first()
                    // console.log('Current Value', currencyObject)
                    let price = null
                    if(currencyObject)
                        price = currencyObject.price
                    alertCache.result = price

                    // console.log('BBAND Log')
                    var bbandLog = await BBandLog.query().insert({
                        valueUpperBand: result.valueUpperBand,
                        valueMiddleBand: result.valueMiddleBand,
                        valueLowerBand: result.valueLowerBand,
                        currency: alert.currency,
                        oldprice: (alertCacheLog)?alertCacheLog.result:null,
                        price,
                        user_id: alert.user.id,
                        telegram_id: alert.user.telegram_id
                    })

                    if(alertCacheLog) {
                        var verifyResult = this.bbandsVerfy(price, alertCacheLog.result, result);
                        if(verifyResult!==false){
                            let action = `➡️ ${verifyResult} Action`;
                            let msg = `♦️ ${alert.currency.replace('/', ' / ')} 
⚠️ Indicator Alert Bollinger Band
🔊 ${alert.indicator} [${alert.timeframe}]
${action}
💰 Value:  
UpperBand = ${this.twoDecimals(result.valueUpperBand)}
MiddleBand = ${this.twoDecimals(result.valueMiddleBand)}
LowerBand = ${this.twoDecimals(result.valueLowerBand)}
CurrenctPrice = ${this.twoDecimals(price)}
🕑 ${currentDate} ${currentTime}`
                            this.sendMessage(alert, msg, AlertIndicator).
                                then(res => {
                                    // console.log('BBAND Log update send success')
                                    BBandLog.query().where('id', bbandLog.id).update({
                                        send_result: res
                                    });
                                }).catch(err => {
                                    // console.log('BBAND Log update send error')
                                    BBandLog.query().where('id', bbandLog.id).update({
                                        send_result: JSON.stringify(err)
                                    });
                                });
                        }

                        AlertCacheLog.query().where('id', alertCacheLog.id).delete().then(res => {
                            AlertCacheLog.logAlertCache(alertCache)
                        }).catch()
                    }else
                        AlertCacheLog.logAlertCache(alertCache).then().catch()

                } else if(alert.indicator=='fibonacciretracement') {
                    // console.log('Alert of ', alert.indicator, alertCache)
                    const currencyObject = await Currency.query().where('name', alert.currency).first()
                    let price = null
                    if(currencyObject)
                        price = currencyObject.price
                    alertCache.result = price

                    // console.log('FIBO Log')
                    var fiboLog = await FiboLog.query().insert({
                        value: result.value,
                        currency: alert.currency,
                        oldprice: (alertCacheLog)?alertCacheLog.result:null,
                        price,
                        user_id: alert.user.id,
                        telegram_id: alert.user.telegram_id
                    })

                    if(alertCacheLog) {
                        let action = `➡️ 0.618 Cross Action`;
                        let msg = `♦️ ${alert.currency.replace('/', ' / ')} 
⚠️ Indicator Alert Fibonacciretracement
🔊 ${alert.indicator} [${alert.timeframe}]
${action}
💰 Value:  Value: ${this.twoDecimals(result.value)}
🕑 ${currentDate} ${currentTime}`
                        if(this.fiboVerfy(price, alertCacheLog.result, result)){
                            this.sendMessage(alert, msg, AlertIndicator).
                                then(res => {
                                    // console.log('FIBO Log update send success')
                                    FiboLog.query().where('id', fiboLog.id).update({
                                        send_result: res
                                    });
                                }).catch(err => {
                                    // console.log('FIBO Log update send error')
                                    FiboLog.query().where('id', fiboLog.id).update({
                                        send_result: JSON.stringify(err)
                                    });
                                });
                        }
                        AlertCacheLog.query().where('id', alertCacheLog.id).delete().then(res => {
                            AlertCacheLog.logAlertCache(alertCache)
                        }).catch()
                    }else
                        AlertCacheLog.logAlertCache(alertCache).then().catch()
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
                    reject(error)
                    return
                }
                if (stderr) {
                    console.log(`stderr: ${stderr}`);
                    reject(stderr)
                    return
                }
                console.log(`stdout: ${stdout}`);
                if(alert.notification=='single')
                    alertClass.query().where('id', alert.id).update({
                        sent: true
                    }).then().catch()
                resolve(stdout)
            });
        })
    }
}


module.exports = TaapiReaderClass