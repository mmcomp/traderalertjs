'use strict'

const CurrencyCache = require('../models/currency_caches.model')
const Currency = require('../models/currencies.model')
const AlertLimit = require('../models/alert_limits.model')

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
                let result = await client.futuresPrices()
                let currencyCashes = await CurrencyCache.query().select('currency').then(items => items.map(it => it.currency))
                // console.log(currencyCashes)
                for(let currency in result){
                    // console.log('Currency : ', currency, 'Price: ', result[currency])
                    if(currencyCashes.indexOf(currency)>=0){
                        that.updateCurrency(currency, result[currency]).then().catch()
                        output[currency] =parseFloat(result[currency])
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
        return new Promise(async function(resolve, reject){
            let selectedCurrencies = []
            for(let currency in currencies){
                if(!isNaN(currencies[currency])){
                    selectedCurrencies.push(currency)
                }
            }
            const {currentDate, currentTime} = BinanceReaderClass.nowDate()
            // console.log(currentDate, currentTime)
            const alerts = await AlertLimit.query()
                .where('sent', false)
                .where('expire_date', '>', currentDate)
                .whereIn('currency', selectedCurrencies)
            // console.log('Alerts', alerts)
            let doAlerts = []
            for(const alert of alerts){
                if(alert.target_price<currencies[alert.currency] && alert.type=='up'){
                    doAlerts.push(alert)
                }else if(alert.target_price>currencies[alert.currency] && alert.type=='down'){
                    doAlerts.push(alert)
                }else if(alert.target_price!=currencies[alert.currency] && alert.type=='cross'){
                    doAlerts.push(alert)
                }
            }
            // console.log('Do Alerts', doAlerts)
            if(doAlerts.length>0){
                that.sendAlerts(doAlerts).then().catch()
            }
            resolve()
        })
    }

    async sendAlerts(doAlerts){
        return new Promise(async function(resolve, reject){
            // console.log('Sending Alerts', doAlerts)
            for(const alert of doAlerts) {
                if(alert.notification=='single'){
                    // console.log('update alert!')
                    AlertLimit.query().patch({
                        sent: true,
                    }).where('id', alert.id).then().catch()
                }
            }
            resolve()
        })
    }
}


module.exports = BinanceReaderClass