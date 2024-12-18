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
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __setFunctionName = (this && this.__setFunctionName) || function (f, name, prefix) {
    if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
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
const Sentry = __importStar(require("@sentry/node"));
const inversify_1 = require("inversify");
exports.GENERIC = "generic";
const MAX_QUEUE_SIZE = 100;
const TIMEOUT = 10000;
let RequestManager = (() => {
    let _classDecorators = [(0, inversify_1.injectable)()];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    var RequestManager = _classThis = class {
        /**@deprecated**/
        static get instance() {
            if (!this._instance) {
                this._instance = new RequestManager();
            }
            return this._instance;
        }
        /**@deprecated**/
        static init() {
            RequestManager.instance;
        }
        /**@deprecated**/
        static get axiosInstance() {
            return RequestManager.instance.defaultInstance;
        }
        constructor() {
            this.defaultInstance = this.createAxiosInstance({});
            this.instances = new Map();
            this.queues = new Map();
            const interfaces = (0, os_1.networkInterfaces)();
            i: for (let id in interfaces) {
                const iface = interfaces[id];
                a: for (let address of iface) {
                    if (!(0, util_1.isPublicNetworkInterface)(address)) {
                        continue i; // skip interface
                    }
                    console.info(`${address.family} ${address.address} ${address.netmask} ${address.mac} ${address.cidr}`);
                    RequestManager.IPS.add(address.address);
                }
            }
            this.setupInstance(exports.GENERIC, {});
            this.setupQueue(exports.GENERIC, time_1.Time.millis(100), 1);
        }
        /**@deprecated**/
        static registerInstance(config) {
            return RequestManager.instance.registerInstance(config);
        }
        registerInstance(config) {
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
                if (!RequestManager.IPS.has(bind)) {
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
            return RequestManager.instance.createAxiosInstance(config);
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
                console.error(`Error in Axios API, status ${(_d = error.response) === null || _d === void 0 ? void 0 : _d.status} ${is429 ? "(429)" : ""}`);
                console.error((_e = error.config) === null || _e === void 0 ? void 0 : _e.url);
                console.error(JSON.stringify(((_f = error.response) === null || _f === void 0 ? void 0 : _f.data) || error.response, null, 2));
                console.error(JSON.stringify((_g = error.response) === null || _g === void 0 ? void 0 : _g.headers, null, 2));
                console.error(JSON.stringify((_h = error.request) === null || _h === void 0 ? void 0 : _h.data, null, 2));
                throw error;
            });
            return instance;
        }
        /**@deprecated**/
        static setupInstance(key, config, constr = (c) => RequestManager.createAxiosInstance(c)) {
            return RequestManager.instance.setupInstance(key, config, constr);
        }
        setupInstance(key, config, constr = (c) => this.createAxiosInstance(c)) {
            this.instances.set(key, constr(config));
            console.log("set up axios instance " + key);
        }
        /**@deprecated**/
        static setupQueue(key, interval, maxPerRun) {
            return RequestManager.instance.setupQueue(key, interval, maxPerRun);
        }
        setupQueue(key, interval, maxPerRun) {
            this.queues.set(key, new jobqu_1.JobQueue(request => {
                return this.runAxiosRequest(request, key);
            }, interval, maxPerRun));
            console.log("set up request queue " + key);
        }
        /**@deprecated**/
        static async runAxiosRequest(request, inst = RequestManager.axiosInstance) {
            return RequestManager.instance.runAxiosRequest(request, inst);
        }
        async runAxiosRequest(request, inst = this.defaultInstance) {
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
        /**@deprecated**/
        static async dynamicRequest(key, request, breadcrumb) {
            return RequestManager.instance.dynamicRequest(key, request, breadcrumb);
        }
        async dynamicRequest(key, request, breadcrumb) {
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
    };
    __setFunctionName(_classThis, "RequestManager");
    (() => {
        const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(null) : void 0;
        __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
        RequestManager = _classThis = _classDescriptor.value;
        if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
    })();
    _classThis.IPS = new Set();
    _classThis.defaultRateLimit = {
        maxRequests: 600,
        perMilliseconds: 10 * 60 * 1000
    };
    (() => {
        __runInitializers(_classThis, _classExtraInitializers);
    })();
    return RequestManager = _classThis;
})();
exports.RequestManager = RequestManager;
//# sourceMappingURL=RequestManager.js.map