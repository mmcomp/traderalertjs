'use strict'

require('dotenv').config()

const Knex = require('knex')
const { Model } = require('objection')

let dbConnection = null
try{
  dbConnection = JSON.parse(process.env.CONNECTION)
}catch(e){}

if(!dbConnection) {
  console.log('Database Connection config is not currect')
  console.log(process.env.CONNECTION)
  process.exit(1)
}

const knex = Knex({
  client: (process.env.CLIENT)?process.env.CLIENT:'mysql',
  useNullAsDefault: true,
  connection: dbConnection,
  pool: { min: 5, max: 30 }
});
Model.knex(knex);

const AlertIndicatorLogic = require('./class/alert_indicator')
const taapi = require("taapi")
const TaapiReaderClass = require('./class/taapi')

const client = taapi.client(process.env.KEY)
const taapiReaderClass = new TaapiReaderClass(client)

const Binance = require('node-binance-api')
const binance = new Binance().options({
  APIKEY: process.env.API_KEY,
  APISECRET: process.env.API_SECRET
})
const BinanceReaderClass = require('./class/binance')
const binanceReaderClass = new BinanceReaderClass(binance)

async function start(){
    // const alertIndicatorLogic = new AlertIndicatorLogic()
    // await alertIndicatorLogic.init()
    // console.log(alertIndicatorLogic)
    // console.log(await taapiReaderClass.rsi("BTC/USDT"))

    taapiReaderClass.readAlerts()

    binanceReaderClass.getFuturesPrices()


    setTimeout(start, process.env.INTERVAL)
}

start()
