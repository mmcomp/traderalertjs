'use strict'

const AlertIndicator = require('../models/alert_indicators.model')
const AlertCache = require('../models/alert_caches.model')
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
            this.sendAlert(alerts, result)
        }catch(e){
            console.log('indicator Error:', e)
        }
    }

    async sendAlert(alerts, result) {
        if((result.value == process.env.INDICATOR_MAX || result.value == process.env.INDICATOR_MIN)) {
            for(const alert of alerts) {
                if(alert.user.telegram_id) {
                    const {currentDate, currentTime} = BinanceReaderClass.nowDate()
                    let msg = `♦️ ${alert.currency.replace('/', ' / ')} 
        
⚠️ Indicator Alert 
    
🔊 ${alert.indicator}
    
💰 Current Value: ${result.value}
    
🕑 ${currentDate} ${currentTime}`
                    exec(`${process.env.BASE_COMMAND} "${msg}" --chat_id=${alert.user.telegram_id}`, (error, stdout, stderr) => {
                        if (error) {
                            console.log(`error: ${error.message}`);
                            return;
                        }
                        if (stderr) {
                            console.log(`stderr: ${stderr}`);
                            return;
                        }
                        console.log(`stdout: ${stdout}`);
                        if(alert.notification=='single')
                            AlertIndicator.query().where('id', alert.id).update({
                                sent: true
                            }).then().catch()
                    });
                }
            }
        }
    }
}


module.exports = TaapiReaderClass