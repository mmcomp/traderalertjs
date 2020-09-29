class test{
    rsiVerfy(alert, alertCacheLog, result) {
        const INDICATOR_MAX =80
        const INDICATOR_MIN = 20
        const INDICATOR_TOLERANCE = 5

        var res = false
        if((alertCacheLog.result.value<INDICATOR_MAX-INDICATOR_TOLERANCE) && (result.value>=INDICATOR_MAX))
            res = true
        else if((alertCacheLog.result.value>INDICATOR_MIN+INDICATOR_TOLERANCE) && (result.value<=INDICATOR_MIN))
            res = true
        return res
    }
}

const testVar = new test()
var pastValue = 26
var currentValue = 20
console.log(pastValue, currentValue, testVar.rsiVerfy(null, {result:{value:pastValue}}, {value:currentValue}))