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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var RequestManager_1;
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
const Sentry = __importStar(require("@sentry/node"));
const inversify_1 = require("inversify");
const core_1 = require("@mineskin/core");
exports.GENERIC = "generic";
const MAX_QUEUE_SIZE = 100;
const TIMEOUT = 10000;
let RequestManager = RequestManager_1 = class RequestManager {
    /**@deprecated**/
    static get instance() {
        if (!this._instance) {
            console.trace("Creating new RequestManager instance");
            this._instance = new RequestManager_1(undefined, undefined);
        }
        return this._instance;
    }
    /**@deprecated**/
    static init() {
        RequestManager_1.instance;
    }
    /**@deprecated**/
    static get axiosInstance() {
        return RequestManager_1.instance.defaultInstance;
    }
    constructor(logProvider, metrics) {
        this.logProvider = logProvider;
        this.metrics = metrics;
        this.defaultInstance = this.createAxiosInstance({});
        this.instances = new Map();
        this.queues = new Map();
        if (!logProvider) {
            console.warn("No log provider injected!");
        }
        else {
            this.logger = logProvider.l.child({ label: "Requests" });
        }
        if (!metrics) {
            console.warn("No metrics provider injected!");
        }
        const interfaces = (0, os_1.networkInterfaces)();
        for (let id in interfaces) {
            const iface = interfaces[id];
            for (let address of iface) {
                if (!(0, util_1.isPublicNetworkInterface)(address)) {
                    continue;
                }
                (this.logger || console).info(`${address.family} ${address.address} ${address.netmask} ${address.mac} ${address.cidr}`);
                RequestManager_1.IPS.add(address.address);
            }
        }
        this.setupInstance(exports.GENERIC, {});
        this.setupQueue(exports.GENERIC, time_1.Time.millis(100), 1);
    }
    /**@deprecated**/
    static registerInstance(config) {
        return RequestManager_1.instance.registerInstance(config);
    }
    registerInstance(config) {
        var _a;
        const key = this.mapKey(config.key);
        if (this.instances.has(key)) {
            (this.logger || console).warn(`Instance with key ${key} already exists!`);
            return;
        }
        if (this.queues.has(key)) {
            (this.logger || console).warn(`Queue with key ${key} already exists!`);
            return;
        }
        if ((_a = config === null || config === void 0 ? void 0 : config.ip) === null || _a === void 0 ? void 0 : _a.bind) {
            const bind = config.ip.bind;
            if (!RequestManager_1.IPS.has(bind)) {
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
            (this.logger || console).info(`Setting up proxy for ${key} via ${config.proxy.host}`);
            config.request.httpsAgent = new https_proxy_agent_1.HttpsProxyAgent(config.proxy);
        }
        if (config.rateLimit) {
            this.setupInstance(key, config.request, c => (0, axios_rate_limit_1.default)(this.createAxiosInstance(c), config.rateLimit));
        }
        else {
            this.setupInstance(key, config.request);
        }
        if (config.queue) {
            this.setupQueue(key, config.queue.interval, config.queue.maxPerRun);
        }
    }
    mapKey(key) {
        if (typeof key === "string") {
            return key;
        }
        return JSON.stringify(key);
    }
    /**@deprecated**/
    static createAxiosInstance(config) {
        return RequestManager_1.instance.createAxiosInstance(config);
    }
    createAxiosInstance(config) {
        const instance = axios_1.default.create(config);
        instance.defaults.headers["User-Agent"] = "MineSkin";
        instance.defaults.headers["Content-Type"] = "application/json";
        instance.defaults.headers["Accept"] = "application/json";
        instance.defaults.timeout = TIMEOUT;
        instance.interceptors.response.use((response) => response, (error) => {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const is429 = ((_a = error.response) === null || _a === void 0 ? void 0 : _a.status) === 429;
            Sentry.captureException(error, {
                level: is429 ? 'fatal' : 'error',
                extra: {
                    responseCode: (_b = error.response) === null || _b === void 0 ? void 0 : _b.status,
                    endpoint: (_c = error.config) === null || _c === void 0 ? void 0 : _c.url
                }
            });
            (this.logger || console).error(`${error.name || 'Error'} ${error.code || ''} in Axios API, status ${(_d = error.response) === null || _d === void 0 ? void 0 : _d.status} ${is429 ? "(429)" : ""}`);
            (this.logger || console).error(error.message);
            (this.logger || console).error((_e = error.config) === null || _e === void 0 ? void 0 : _e.url);
            (this.logger || console).error(JSON.stringify((_f = error.response) === null || _f === void 0 ? void 0 : _f.data, null, 2));
            (this.logger || console).error(JSON.stringify((_g = error.response) === null || _g === void 0 ? void 0 : _g.headers, null, 2));
            (this.logger || console).error(JSON.stringify((_h = error.request) === null || _h === void 0 ? void 0 : _h.data, null, 2));
            return Promise.reject(error);
        });
        return instance;
    }
    /**@deprecated**/
    static setupInstance(key, config, constr = (c) => RequestManager_1.createAxiosInstance(c)) {
        return RequestManager_1.instance.setupInstance(key, config, constr);
    }
    setupInstance(key, config, constr = (c) => this.createAxiosInstance(c)) {
        this.instances.set(key, constr(config));
        (this.logger || console).info("set up axios instance " + key);
    }
    /**@deprecated**/
    static setupQueue(key, interval, maxPerRun) {
        return RequestManager_1.instance.setupQueue(key, interval, maxPerRun);
    }
    setupQueue(key, interval, maxPerRun) {
        this.queues.set(key, new jobqu_1.JobQueue(request => {
            return this.runAxiosRequest(request, key);
        }, interval, maxPerRun));
        (this.logger || console).info("set up request queue " + key);
    }
    /**@deprecated**/
    static async runAxiosRequest(request, inst = RequestManager_1.axiosInstance) {
        return RequestManager_1.instance.runAxiosRequest(request, inst);
    }
    async runAxiosRequest(request, inst = this.defaultInstance) {
        return await Sentry.startSpan({
            op: 'request',
            name: 'runAxiosRequest'
        }, async (span) => {
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
            const start = Date.now();
            let breadcrumb = ((_a = request.headers) === null || _a === void 0 ? void 0 : _a["X-MineSkin-Breadcrumb"]) || "00000000";
            (this.logger || console).debug(`${breadcrumb} ==> ${request.method || 'GET'} ${request.url} via ${instanceKey}`);
            const response = await instance.request(request);
            const end = Date.now();
            (this.logger || console).debug(`${breadcrumb} <== ${request.method || 'GET'} ${request.url} (${response.status}) in ${end - start}ms`);
            return response;
        });
    }
    /**@deprecated**/
    static async dynamicRequest(key, request, breadcrumb) {
        return RequestManager_1.instance.dynamicRequest(key, request, breadcrumb);
    }
    async dynamicRequest(key, request, breadcrumb) {
        return await Sentry.startSpan({
            op: 'request',
            name: 'dynamicRequest'
        }, async (span) => {
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
                (this.logger || console).warn(`${breadcrumb} Rejecting new request as queue for ${k} is full (${q.size})! `);
                throw new Error("Request queue is full!");
            }
            (this.logger || console).debug(`${breadcrumb} ... ${request.method || 'GET'} ${request.url}`);
            return await q.add(request);
        });
    }
};
exports.RequestManager = RequestManager;
RequestManager.IPS = new Set();
RequestManager.defaultRateLimit = {
    maxRequests: 600,
    perMilliseconds: 10 * 60 * 1000
};
exports.RequestManager = RequestManager = RequestManager_1 = __decorate([
    (0, inversify_1.injectable)(),
    __param(0, (0, inversify_1.inject)(core_1.TYPES.LogProvider)),
    __param(1, (0, inversify_1.inject)(core_1.TYPES.MetricsProvider)),
    __metadata("design:paramtypes", [Object, Object])
], RequestManager);
//# sourceMappingURL=RequestManager.js.map