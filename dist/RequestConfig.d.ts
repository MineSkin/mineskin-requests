import { rateLimitOptions } from "axios-rate-limit";
import { AxiosRequestConfig } from "axios";
export type RequestKey = string | any;
export interface RequestConfig<K extends RequestKey> {
    key: K;
    queue?: {
        interval: number;
        maxPerRun: number;
    };
    rateLimit?: rateLimitOptions;
    request: AxiosRequestConfig;
}
