"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestManager = exports.GENERIC = void 0;
const axios_1 = __importDefault(require("axios"));
const jobqu_1 = require("jobqu");
const axios_rate_limit_1 = __importDefault(require("axios-rate-limit"));
const time_1 = require("@inventivetalent/time");
const os_1 = require("os");
const https = __importStar(require("node:https"));
const https_proxy_agent_1 = require("https-proxy-agent");
const util_1 = require("./util");
exports.GENERIC = "generic";
const MAX_QUEUE_SIZE = 100;
const TIMEOUT = 10000;
axios_1.default.defaults.headers["User-Agent"] = "MineSkin";
axios_1.default.defaults.headers["Content-Type"] = "application/json";
axios_1.default.defaults.headers["Accept"] = "application/json";
axios_1.default.defaults.timeout = TIMEOUT;
class RequestManager {
    static init() {
        const interfaces = (0, os_1.networkInterfaces)();
        i: for (let id in interfaces) {
            const iface = interfaces[id];
            a: for (let address of iface) {
                if (!(0, util_1.isPublicNetworkInterface)(address)) {
                    continue i; // skip interface
                }
                console.info(`${address.family} ${address.address} ${address.netmask} ${address.mac} ${address.cidr}`);
                this.IPS.push(address.address);
            }
        }
        this.setupInstance(exports.GENERIC, {});
        this.setupQueue(exports.GENERIC, time_1.Time.millis(100), 1);
    }
    static registerInstance(config) {
        var _a;
        const key = this.mapKey(config.key);
        if (this.instances.has(key)) {
            console.warn(`Instance with key ${key} already exists!`);
            return;
        }
        if (this.queues.has(key)) {
            console.warn(`Queue with key ${key} already exists!`);
            return;
        }
        if ((_a = config === null || config === void 0 ? void 0 : config.ip) === null || _a === void 0 ? void 0 : _a.bind) {
            const bind = config.ip.bind;
            if (!this.IPS.includes(bind)) {
                console.warn(`IP ${bind} not found on this machine`);
            }
            else {
                console.info(`Binding ${key} to IP ${bind}`);
                config.request.httpsAgent = new https.Agent({
                    localAddress: config.ip.bind,
                    family: config.ip.bind.includes(":") ? 6 : 4
                });
            }
        }
        if (config.proxy) {
            console.info(`Setting up proxy for ${key} via ${config.proxy.host}`);
            config.request.httpsAgent = new https_proxy_agent_1.HttpsProxyAgent(config.proxy);
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
        var _a;
        let instance;
        let instanceKey = "default";
        if (typeof inst === "string") {
            instance = this.instances.get(inst);
            instanceKey = inst;
        }
        else {
            instance = inst;
        }
        if (!instance) {
            throw new Error("No instance found for key " + inst);
        }
        let breadcrumb = ((_a = request.headers) === null || _a === void 0 ? void 0 : _a["X-MineSkin-Breadcrumb"]) || "00000000";
        console.log(`${breadcrumb} => ${request.method} ${request.url} via ${instanceKey}`);
        return instance.request(request);
    }
    static async dynamicRequest(key, request, breadcrumb) {
        const k = this.mapKey(key);
        const q = this.queues.get(k);
        if (breadcrumb) {
            request.headers = request.headers || {};
            request.headers["X-MineSkin-Breadcrumb"] = breadcrumb;
        }
        if (!q) {
            return this.runAxiosRequest(request, k);
            //throw new Error("No queue found for key " + k);
        }
        if (q.size > MAX_QUEUE_SIZE) {
            console.warn(`${breadcrumb} Rejecting new request as queue for ${k} is full (${q.size})! `);
            throw new Error("Request queue is full!");
        }
        return await q.add(request);
    }
}
exports.RequestManager = RequestManager;
RequestManager.IPS = [];
RequestManager.axiosInstance = axios_1.default.create({});
RequestManager.defaultRateLimit = {
    maxRequests: 600,
    perMilliseconds: 10 * 60 * 1000
};
RequestManager.instances = new Map();
RequestManager.queues = new Map();
//# sourceMappingURL=RequestManager.js.map