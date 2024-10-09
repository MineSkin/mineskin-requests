import { NetworkInterfaceInfo } from "node:os";
export declare function isPublicNetworkInterface(address: NetworkInterfaceInfo): boolean;
export declare function isPublicIPv4(address: string): boolean;
export declare function isPublicIPv6(address: string): boolean;
