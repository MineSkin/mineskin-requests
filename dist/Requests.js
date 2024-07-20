"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Requests = exports.GENERIC = void 0;
const axios_1 = __importDefault(require("axios"));
const jobqu_1 = require("jobqu");
const axios_rate_limit_1 = __importDefault(require("axios-rate-limit"));
const time_1 = require("@inventivetalent/time");
exports.GENERIC = "generic";
const MAX_QUEUE_SIZE = 100;
const TIMEOUT = 10000;
axios_1.default.defaults.headers["User-Agent"] = "MineSkin";
axios_1.default.defaults.headers["Content-Type"] = "application/json";
axios_1.default.defaults.headers["Accept"] = "application/json";
axios_1.default.defaults.timeout = TIMEOUT;
class Requests {
    static init() {
        this.setupInstance(exports.GENERIC, {});
        this.setupQueue(exports.GENERIC, time_1.Time.millis(100), 1);
    }
    static registerInstance(config) {
        const key = this.mapKey(config.key);
        if (this.instances.has(key)) {
            console.warn(`Instance with key ${key} already exists!`);
            return;
        }
        if (this.queues.has(key)) {
            console.warn(`Queue with key ${key} already exists!`);
            return;
        }
        if (config.rateLimit) {
            this.setupInstance(key, config.request, c => (0, axios_rate_limit_1.default)(axios_1.default.create(c), config.rateLimit));
        }
        else {
            this.setupInstance(key, config.request);
        }
        if (config.queue) {
            this.setupQueue(key, config.queue.interval, config.queue.maxPerRun);
        }
    }
    static mapKey(key) {
        if (typeof key === "string") {
            return key;
        }
        return JSON.stringify(key);
    }
    static setupInstance(key, config, constr = (c) => axios_1.default.create(c)) {
        this.instances.set(key, axios_1.default.create(config));
        console.log("set up axios instance " + key);
    }
    static setupQueue(key, interval, maxPerRun) {
        this.queues.set(key, new jobqu_1.JobQueue(request => {
            return this.runAxiosRequest(request, key);
        }, interval, maxPerRun));
        console.log("set up request queue " + key);
    }
    static async runAxiosRequest(request, inst = this.axiosInstance) {
        let instance;
        if (typeof inst === "string") {
            instance = this.instances.get(inst);
        }
        else {
            instance = inst;
        }
        if (!instance) {
            throw new Error("No instance found for key " + inst);
        }
        console.log(`=> ${request.method} ${request.url}`);
        return instance.request(request);
    }
    static async dynamicRequest(key, request) {
        const k = this.mapKey(key);
        const q = this.queues.get(k);
        if (!q) {
            throw new Error("No queue found for key " + k);
        }
        if (q.size > MAX_QUEUE_SIZE) {
            console.warn(`Rejecting new request as queue for ${k} is full (${q.size})! `);
            throw new Error("Request queue is full!");
        }
        return await q.add(request);
    }
}
exports.Requests = Requests;
Requests.axiosInstance = axios_1.default.create({});
Requests.defaultRateLimit = {
    maxRequests: 600,
    perMilliseconds: 10 * 60 * 1000
};
Requests.instances = new Map();
Requests.queues = new Map();
//# sourceMappingURL=Requests.js.map