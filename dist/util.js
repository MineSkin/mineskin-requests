"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isPublicNetworkInterface = isPublicNetworkInterface;
exports.isPublicIPv4 = isPublicIPv4;
exports.isPublicIPv6 = isPublicIPv6;
const ip_address_1 = require("ip-address");
const IPV4_BOGON = [
    '0.0.0.0/8',
    '10.0.0.0/8',
    '100.64.0.0/10',
    '127.0.0.0/8',
    '127.0.53.53',
    '169.254.0.0/16',
    '172.16.0.0/12',
    '192.0.0.0/24',
    '192.0.2.0/24',
    '192.168.0.0/16',
    '198.18.0.0/15',
    '198.51.100.0/24',
    '203.0.113.0/24',
    '224.0.0.0/4',
    '240.0.0.0/4',
    '255.255.255.255/32'
];
function isPublicNetworkInterface(address) {
    if (address.internal) {
        return false;
    }
    if (address.family === "IPv4") {
        if (!isPublicIPv4(address.address)) {
            return false;
        }
    }
    if (address.family === "IPv6") {
        if (!isPublicIPv6(address.address)) {
            return false;
        }
    }
    return true;
}
function isPublicIPv4(address) {
    const addr = new ip_address_1.Address4(address);
    if (!addr.isCorrect()) {
        return false;
    }
    for (let bogon of IPV4_BOGON) {
        if (addr.isInSubnet(new ip_address_1.Address4(bogon))) {
            return false;
        }
    }
    return true;
}
function isPublicIPv6(address) {
    const addr = new ip_address_1.Address6(address);
    if (!addr.isCorrect()) {
        return false;
    }
    if (addr.isLinkLocal() || addr.isLoopback()) {
        return false;
    }
    if (addr.getScope() !== 'Global') {
        return false;
    }
    return true;
}
//# sourceMappingURL=util.js.map