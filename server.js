require("dotenv").config(); // require dotenv
const cli = require("next/dist/cli/next-dev");
cli.nextDev(["-p", process.env.PORT || 3122]);
