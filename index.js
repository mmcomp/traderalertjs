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
// const taapi = require("taapi")
const taapi = require("./class/faketaapi")
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
  try{
    await binanceReaderClass.getFuturesPrices()
  }catch(e){
    console.log('Binance Start Error')
    console.log(e)
  }
  setTimeout(binanceRoutine, parseInt(process.env.BINANCE_INTERVAL, 10))
}

async function taapiRoutine() {
  console.log('Start Tapi proccess ....')
  try{
    await taapiReaderClass.readAlerts()
  }catch(e){
    console.log('Taapi Start Error')
    console.log(e)
  }
  setTimeout(taapiRoutine, parseInt(process.env.TAAPI_INTERVAL, 10))
}

async function start(){
  console.log('Trader Alert Starting ....')
  // taapiRoutine()
  binanceRoutine()
}

start()
