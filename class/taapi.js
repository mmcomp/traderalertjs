class TaapiReaderClass {
    constructor (client){
        this.client = client
    }

    async getIndicator(indicator, source, symbol, interval, params, backtrack) {
        let client = this.client
        return new Promise(async function(resolve, reject){
            try{
                let result = await client.getIndicator(indicator, source, symbol, interval, params, backtrack)
                console.log("Result: ", result)
                resolve(result)
            }catch(e){
                reject(e)
            }
        })
    }
}


module.exports = TaapiReaderClass