require('dotenv').config()
const taapi = require("taapi")
const ReaderClass = require('./class/taapi')

const client = taapi.client(process.env.KEY)
const readerClass = new ReaderClass(client)
readerClass.getIndicator("macd", "binance", "BTC/USDT", "4h")
