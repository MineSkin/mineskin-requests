import { rateLimitOptions } from "axios-rate-limit";
import { AxiosRequestConfig } from "axios";
import { HttpsProxyAgentOptions } from "https-proxy-agent";
import { IAxiosRetryConfig } from "axios-retry";

export type RequestKey = string | any;

export interface RequestConfig<K extends RequestKey> {
    key: K;
    queue?: {
        interval: number;
        maxPerRun: number;
    };
    ip?: {
        bind?: string;
    };
    proxy?: HttpsProxyAgentOptions;
    rateLimit?: rateLimitOptions;
    retry?: IAxiosRetryConfig;
    request: AxiosRequestConfig;
}