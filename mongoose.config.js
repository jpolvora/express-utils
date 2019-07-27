const mongoose = require("mongoose");

mongoose.Promise = global.Promise;
mongoose.set("debug", process.env.MONGOOSE_DEBUG === "1");
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);

if (typeof process.env.COLLECTION_PREFIX === "string") {
    const createModel = mongoose.model.bind(mongoose);
    mongoose.model = (name, schema, collection) => {
        if (name && schema) {
            schema.options = schema.options || {}
            collection = collection || schema.options.collection;
            if (!collection) throw new Error('missing collection parameter for schema: ' + name)
            const pref = process.env.COLLECTION_PREFIX;
            const new_collection = collection.indexOf(pref) >= 0
                ? collection
                : `${process.env.COLLECTION_PREFIX}${collection}`.toLowerCase()
            //if (collection.indexOf('files') >= 0) debugger;
            console.log('model/collection: %s:%s ', name, new_collection)
            return createModel(name, schema, new_collection)
        }
        return createModel(name)
    }
}

require('mongoose-float').loadType(mongoose, 2);

const initAllModels = require("./models/all");

// function myPlugin() {
//     console.log(arguments);
// }

// mongoose.plugin((schema, options) => {
//     console.log(schema, options);
//     schema.pre('find', myPlugin);
//     schema.pre('findById', myPlugin);
//     schema.pre('findOne', myPlugin);
//     schema.pre('findOneAndUpdate', myPlugin);
//     schema.pre('count', myPlugin);
// });

// mongoose.plugin(function (schema, options = {}) {
//     console.log(arguments)
//     schema.pre('init', function () {
//         console.log('schema init', arguments)
//     })
// })

mongoose.connection.on("connected", async () => {
    console.log("Connected to mongodb at: " + process.env.MONGODB_URI);
});

mongoose.connection.on("disconnected", function () {
    console.log("Disconnected to mongodb");
});

mongoose.connection.on("error", function (e) {
    console.error(e);
});

module.exports = async () => {
    try {
        if (mongoose.connection.readyState === 1) return mongoose.connection;
        await mongoose.connect(process.env.MONGODB_URI, { autoIndex: true });
        await initAllModels();
        return mongoose.connection;
    } catch (error) {
        console.error(error);
        throw error;
    }
}
