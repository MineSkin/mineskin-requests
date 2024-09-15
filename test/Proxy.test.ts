// import '@types/jest';
import { GENERIC, RequestManager } from "../src";
import * as process from "node:process";

describe('Proxy', () => {

    beforeAll(async () => {
        RequestManager.init();

        RequestManager.registerInstance({
            key: GENERIC + "proxy",
            request: {
                baseURL: "https://api64.ipify.org",
            },
            proxy: {
                host: process.env.TEST_PROXY_HOST || "localhost",
                port: 8888,
                auth: process.env.TEST_PROXY_AUTH || undefined,
            }
        })
    });

    describe('request()', () => {
        test('should make a request', async () => {
            try {
                const response = await RequestManager.dynamicRequest(GENERIC + "proxy", {
                    method: "GET",
                    url: "/?format=json",

                });
                console.log(response.data);
                expect(response.status).toEqual(200);
                expect(response.data).toBeDefined();
                expect(response.data.ip).toBeDefined();
                expect(response.data.ip).toEqual(process.env.TEST_PROXY_IP!);
            } catch (e) {
                if (e.response) {
                    console.error(e.response.data);
                }
                throw e;
            }
        });
    })

});