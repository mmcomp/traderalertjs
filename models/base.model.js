'use strict'
const { Model } = require('objection')

class BaseModel extends Model {
  /*
    static query(...args) {
      return super.query(...args).onBuildKnex((knexQueryBuilder, builder) => {
        knexQueryBuilder.on('query', queryData => {
          // queryData contains the sql (not really sure in which format. I've never used this).
          // Now you can do what you want with the query. One option is to save it to the builder's
          // context.
          builder.context().queries.push(queryData);
        });
      });
    }
  */
}

module.exports = BaseModel