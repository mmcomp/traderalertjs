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

async function binanceRoutine() {
  console.log('Start Binance proccess ....')
  await binanceReaderClass.getFuturesPrices()

  setTimeout(binanceRoutine, process.env.BINANCE_INTERVAL)
}

async function taapiRoutine() {
  console.log('Start Tapi proccess ....')
  await taapiReaderClass.readAlerts()

  setTimeout(taapiRoutine, process.env.TAAPI_INTERVAL)
}

async function start(){
  console.log('Trader Alert Starting ....')
  taapiRoutine()
  binanceRoutine()
}

start()
