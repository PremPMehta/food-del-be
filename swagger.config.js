const swaggerAutogen = require("swagger-autogen")();

const doc = {
  info: {
    title: "Food Delivery API",
    description: "It's backend for an online food delivery application tailered for caterers.",
  },
  host: "localhost:3000",
};

const outputFile = "./swagger.json";
const routes = ["./index.js"];

/* NOTE: If you are using the express Router, you must pass in the 'routes' only the 
root file where the route starts, such as index.js, app.js, routes.js, etc ... */

swaggerAutogen(outputFile, routes, doc);
