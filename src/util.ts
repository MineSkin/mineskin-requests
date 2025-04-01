import { NetworkInterfaceInfo } from "node:os";
import { Address4, Address6 } from "ip-address";

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

const IPV6_BOGON = [
    '::/128',
    '::1/128',
    '::ffff:0:0/96',
    '::/96',
    '100::/64',
    '2001:10::/28',
    '2001:db8::/32',
    'fc00::/7',
    'fe80::/10',
    'fec0::/10',
    'ff00::/8'
];


export function isPublicNetworkInterface(address: NetworkInterfaceInfo) {
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

export function isPublicIPv4(address: string) {
    const addr = new Address4(address);
    if (!addr.isCorrect()) {
        return false;
    }

    for (let bogon of IPV4_BOGON) {
        if (addr.isInSubnet(new Address4(bogon))) {
            return false;
        }
    }

    return true;
}

export function isPublicIPv6(address: string) {
    const addr = new Address6(address);
    if (!addr.isCorrect()) {
        return false;
    }
    if (addr.isLinkLocal() || addr.isLoopback()) {
        return false;
    }
    if (addr.getScope() !== 'Global') {
        return false;
    }

    for (let bogon of IPV6_BOGON) {
        if (addr.isInSubnet(new Address6(bogon))) {
            return false;
        }
    }

    return true;
}