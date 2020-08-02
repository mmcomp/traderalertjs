'use strict'

// const CurrencyCache = require('../models/currency_caches.model')
const fs = require('fs')
const Currency = require('../models/currencies.model')
const AlertLimit = require('../models/alert_limits.model')
const AlertLimitLog = require('../models/alert_limit_logs.model')

const { exec } = require("child_process")

class BinanceReaderClass {
    constructor (client){
        this.client = client
    }

    async updateCurrency(currency, price){
        return new Promise(async function(resolve, reject){
            try{
                const numUpdated = await Currency.query().patch({
                    price
                }).where('name', currency)

                if(numUpdated<=0){
                    await Currency.query().insert({
                        name: currency,
                        price
                    })
                }
                resolve()
            }catch(e){
                reject(e)
            }
        })
    }

    async getFuturesPrices() {
        let client = this.client
        let that = this
        return new Promise(async function(resolve, reject){
            try{
                let output = {}
                let result = []

                const cachePath = process.env.CACHE_PATH
                if(process.env.IS_TEST!='false' && fs.existsSync(cachePath))
                    result = JSON.parse(fs.readFileSync(cachePath))
                else{
                    result = await client.prices()
                    if(process.env.IS_TEST!='false'){
                        const dataToStore = JSON.stringify(result)
                        fs.writeFileSync(cachePath,  dataToStore)
                    }
                }

                // console.log('New Data : ', result)

                const currencies = await Currency.query().select('name', 'id').where('enabled', 'yes')//.then(items => items.map(it => it.name.replace('/', '')))
                let selectedCurrencies = {}
                for(let curr of currencies){
                    let nm = curr.name
                    selectedCurrencies[nm.replace('/', '')] = {
                        id: curr.id,
                        name: curr.name,
                    }
                }
                
                for(let currency in result){
                    if(selectedCurrencies[currency]){
                        that.updateCurrency(selectedCurrencies[currency].name, result[currency]).then().catch()
                        output[selectedCurrencies[currency].name] = parseFloat(result[currency])
                    }
                }
                that.findAlerts(output)
                
                resolve(output)
            }catch(e){
                reject(e)
            }
        })
    }

    static nowDate(){
        function twoDigit(inp){
            let tmp = parseInt(inp, 10)
            if(isNaN(tmp) || (!isNaN(tmp) && tmp>=10))
                return inp
            return `0${tmp}`
        } 

        const now = new Date()
        const currentDate = now.getFullYear() + '-' + twoDigit(now.getMonth() + 1)  + '-' + twoDigit(now.getDate())
        const currentTime = now.getHours() + ':' + twoDigit(now.getMinutes()) + ':' + twoDigit(now.getSeconds())
        return {
            currentDate,
            currentTime
        }
    }

    async findAlerts(currencies){
        const that = this
        console.log('currencies', currencies)
        return new Promise(async function(resolve, reject){
            let selectedCurrencies = []
            for(let currency in currencies){
                if(!isNaN(currencies[currency])){
                    selectedCurrencies.push(currency)
                }
            }
            console.log('Selected Currency', selectedCurrencies)
            const {currentDate, currentTime} = BinanceReaderClass.nowDate()
            // console.log(currentDate, currentTime)
            const alerts = await AlertLimit.query().withGraphFetched('user')
                .where('sent', false)
                .where(function(query) {
                    query.where('expire_date', '>', currentDate).orWhere('expire_date', null).orWhere('expire_date', '').orWhere('expire_date', '0000-00-00 00:00:00')
                })
                .whereIn('currency', selectedCurrencies)
                
            console.log('Alerts', alerts)
            let doAlerts = []
            for(const alert of alerts){
                console.log('Check alert:', alert.id, alert.target_price, currencies[alert.currency], alert.type)
                const alertLimitl = await AlertLimitLog.query().where('alert_limits_id', alert.id).first()
                console.log('has old!', alertLimitl)
                if(typeof alertLimitl!='undefined'){
                    if((alert.type=='up' && currencies[alert.currency]<alert.target_price) || 
                        (alert.type=='down' && currencies[alert.currency]>alert.target_price)){
                        alert['alerted_price'] = currencies[alert.currency]
                        AlertLimitLog.query().where('alert_limits_id', alert.id).delete().then(res=>{AlertLimitLog.logAlertLimit(alert)}).catch(e=>{})
                        continue
                    }
                    if((alert.type=='up' && currencies[alert.currency]>alert.target_price && alertLimitl.alerted_price>alert.target_price) || 
                        (alert.type=='down' && currencies[alert.currency]<alert.target_price && alertLimitl.alerted_price<alert.target_price)){
                        alert['alerted_price'] = currencies[alert.currency]
                        AlertLimitLog.query().where('alert_limits_id', alert.id).delete().then(res=>{AlertLimitLog.logAlertLimit(alert)}).catch(e=>{})
                        continue
                    }
                    console.log(currencies[alert.currency], alert.target_price, alertLimitl.alerted_price)
                    if(alert.type=='cross' && ((currencies[alert.currency]>alert.target_price && alertLimitl.alerted_price>alert.target_price) || (currencies[alert.currency]<alert.target_price && alertLimitl.alerted_price<alert.target_price))){
                        console.log('CROSS!')
                        alert['alerted_price'] = currencies[alert.currency]
                        AlertLimitLog.query().where('alert_limits_id', alert.id).delete().then(res=>{AlertLimitLog.logAlertLimit(alert)}).catch(e=>{})
                        continue
                    }else{
                        AlertLimitLog.query().where('alert_limits_id', alert.id).delete().then(res=>{}).catch(e=>{})
                    }
                }
                if(alert.target_price<currencies[alert.currency] && alert.type=='up'){
		            console.log('UP')
                    alert['alerted_price'] = currencies[alert.currency]
                    doAlerts.push(alert)
                }else if(alert.target_price>currencies[alert.currency] && alert.type=='down'){
		            console.log('DOWN')
                    alert['alerted_price'] = currencies[alert.currency]
                    doAlerts.push(alert)
                }else if(alert.target_price!=currencies[alert.currency] && alert.type=='cross'){
		            console.log('CROSS')
                    alert['alerted_price'] = currencies[alert.currency]
                    doAlerts.push(alert)
                }
            }
            // console.log('Do Alerts', doAlerts)
            if(doAlerts.length>0){
                that.sendAlerts(doAlerts).then().catch(e => {console.log('send alerts error: ', e)})
            }
            resolve()
        })
    }

    async sendAlerts(doAlerts){
        return new Promise(async function(resolve, reject){
            console.log('Sending Alerts', doAlerts)
            for(const alert of doAlerts) {
                if(alert.notification=='single'){
                    console.log('update alert!')
                    AlertLimit.query().patch({
                        sent: true,
                    }).where('id', alert.id).then().catch()
                }
                
                const alertLimitl = await AlertLimitLog.query().where('alert_limits_id', alert.id).where('alerted_price', alert.alerted_price).first()

           	    console.log(alertLimitl) 
                if(alert.user.telegram_id && typeof alertLimitl=='undefined'){
                    const {currentDate, currentTime} = BinanceReaderClass.nowDate()
                    let msg = `♦️ ${alert.currency} 

                    ⚠️ Limits Alert 
                    
                    🔊 ${alert.type} ${alert.target_price}
                    
                    💰 Current Price: ${alert.alerted_price}
                    
                    🕑 ${currentDate} ${currentTime}`
                    // console.log(`${process.env.BASE_COMMAND} "${currentDate} ${currentTime} : Limits Alert ${alert.currency} ${alert.type} on ${alert.target_price}" --chat_id=${alert.user.telegram_id}`)
                    // let msg = `${currentDate} ${currentTime} : Limits Alert ${alert.currency} ${alert.type} on ${alert.target_price}`
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
                        AlertLimitLog.logAlertLimit(alert).then(res => console.log('add', res)).catch(e => console.log('err', e))
                    });
                }
            }

            resolve()
        })
    }
}


module.exports = BinanceReaderClass
