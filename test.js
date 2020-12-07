/*
const taapi = require("taapi")
const client = taapi.client("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImhzY29tcDIwMDJAZ21haWwuY29tIiwiaWF0IjoxNTkxODEyODczLCJleHAiOjc4OTkwMTI4NzN9.iDJhyuqT2_KR_pTzIgmpt5j4VquaApt_G7QpDZWEkrM")


client.getIndicator("fibonacciretracement", "binance", "BTC/USDT", "4h").then(function(result) {
    console.log("Result: ", result);
});
*/
var axios = require('axios');
class FakeTaapi {
    static client(token) {
        return {
            async getIndicator(indicator, source, symbol, interval, params, backtrack) {
                let rest_params = {
                    secret: token,
                    exchange: source,
                    symbol: symbol,
                    interval: interval
                };
                if(params) {
                    for(var key in params)
                        rest_params[key] = params[key];
                }
                if(backtrack)
                    rest_params['backtrack'] = backtrack;
                return new Promise(function(resolve, reject) {
                    axios.get('https://api.taapi.io/' + indicator, {
                        params: rest_params
                    })
                    .then(function (response) {
                        resolve(response);
                    })
                    .catch(function (error) {
                        reject(error);
                    });
                });
            }
            
        };
    }
}

function fixCurrency(inp) {
    if(inp.indexOf('/')>0)
        return inp;
    const baseCurrencies = ["BTC","USDT","ETH","BNB","PAX","USDC","TUSD","XRP","RUB","EUR","BUSD","ZAR","BKRW","IDRT","UAH","BIDR","DAI","AUD","GBP"];
    for(var baseCurrency of baseCurrencies) {
        if(inp.indexOf(baseCurrency)>0) {
            return inp.replace(baseCurrency, '/' + baseCurrency);
        }
    }
    return inp;
}

const taapi = FakeTaapi;
const client = taapi.client("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImhzY29tcDIwMDJAZ21haWwuY29tIiwiaWF0IjoxNjA3MjQ3Njc0LCJleHAiOjc5MTQ0NDc2NzR9.xcflcz0alaq4aRwHK95FkzsHbg1TiHYIVTjX9o8Vwe0");
client.getIndicator('bbands', 'binance', fixCurrency('BTC/USDT'), '1h', {optlnTimePeriod: "20"}) .then(response => {
    console.log(response.data);
}).catch(error => {
    console.log(error.response.data);
})
/*
async function getIndicator(indicator, source, symbol, interval, params, backtrack) {
    let rest_params = {
        secret: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImhzY29tcDIwMDJAZ21haWwuY29tIiwiaWF0IjoxNjA3MjQ3Njc0LCJleHAiOjc5MTQ0NDc2NzR9.xcflcz0alaq4aRwHK95FkzsHbg1TiHYIVTjX9o8Vwe0",
        exchange: source,
        symbol: symbol,
        interval: interval
    };
    if(params) {
        for(var key in params)
            rest_params[key] = params[key];
    }
    if(backtrack)
        rest_params['backtrack'] = backtrack;
    return new Promise(function(resolve, reject) {
        axios.get('https://api.taapi.io/' + indicator, {
            params: rest_params
        })
        .then(function (response) {
            resolve(response);
        })
        .catch(function (error) {
            reject(error);
        });
    });
}

getIndicator('bbands', 'binance', 'BTC/USDT', '1h', {optlnTimePeriod: "20"}) .then(response => {
    console.log(response.data);
}).catch(error => {
    console.log(error.response.data);
})
*/
/*
axios.get('https://api.taapi.io/bbands', {
  params: {
    secret: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImhzY29tcDIwMDJAZ21haWwuY29tIiwiaWF0IjoxNjA3MjQ3Njc0LCJleHAiOjc5MTQ0NDc2NzR9.xcflcz0alaq4aRwHK95FkzsHbg1TiHYIVTjX9o8Vwe0",
    exchange: "binance",
    symbol: "BTC/USDT",
    interval: "1h",
    optlnTimePeriod: "20"
  }
})
.then(function (response) {
  console.log(response.data);
})
.catch(function (error) {
  console.log(error.response.data);
});
*/
