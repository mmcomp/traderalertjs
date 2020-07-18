'use strict'

const CurrencyCache = require('../models/currency_caches')
const Currency = require('../models/currencies')

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
                let output = []
                let result = await client.futuresPrices()
                let currencyCashes = await CurrencyCache.query().select('currency').then(items => items.map(it => it.currency))
                // console.log(currencyCashes)
                for(let currency in result){
                    // console.log('Currency : ', currency, 'Price: ', result[currency])
                    if(currencyCashes.indexOf(currency)>=0){
                        that.updateCurrency(currency, result[currency]).then().catch()
                        output.push(currency)
                    }
                }
                resolve(output)
            }catch(e){
                reject(e)
            }
        })
    }
}


module.exports = BinanceReaderClass