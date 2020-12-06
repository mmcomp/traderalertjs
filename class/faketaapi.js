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

module.exports = FakeTaapi;