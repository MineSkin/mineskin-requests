/** @type {import('ts-jest').JestConfigWithTsJest} **/
module.exports = {
    testEnvironment: "node",
    transform: {
        "^.+.tsx?$": ["ts-jest", {}],
    },
    setupFiles: process.env.CI ? [] : ["<rootDir>/.jest/setEnvVars.js"]
};