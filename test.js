const taapi = require("taapi")
const client = taapi.client("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImhzY29tcDIwMDJAZ21haWwuY29tIiwiaWF0IjoxNTkxODEyODczLCJleHAiOjc4OTkwMTI4NzN9.iDJhyuqT2_KR_pTzIgmpt5j4VquaApt_G7QpDZWEkrM")


client.getIndicator("fibonacciretracement", "binance", "BTC/USDT", "4h").then(function(result) {
    console.log("Result: ", result);
});