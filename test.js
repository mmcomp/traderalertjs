/*
const taapi = require("taapi")
const client = taapi.client("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImhzY29tcDIwMDJAZ21haWwuY29tIiwiaWF0IjoxNTkxODEyODczLCJleHAiOjc4OTkwMTI4NzN9.iDJhyuqT2_KR_pTzIgmpt5j4VquaApt_G7QpDZWEkrM")


client.getIndicator("fibonacciretracement", "binance", "BTC/USDT", "4h").then(function(result) {
    console.log("Result: ", result);
});
*/


var axios = require('axios');

axios.get('https://api.taapi.io/rsi', {
  params: {
    secret: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImhzY29tcDIwMDJAZ21haWwuY29tIiwiaWF0IjoxNjA3MjQ3Njc0LCJleHAiOjc5MTQ0NDc2NzR9.xcflcz0alaq4aRwHK95FkzsHbg1TiHYIVTjX9o8Vwe0",
    exchange: "binance",
    symbol: "BTC/USDT",
    interval: "1h",
  }
})
.then(function (response) {
  console.log(response.data);
})
.catch(function (error) {
  console.log(error.response.data);
});