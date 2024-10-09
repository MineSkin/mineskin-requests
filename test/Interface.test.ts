// import '@types/jest';
import { isPublicIPv4, isPublicIPv6, isPublicNetworkInterface } from "../src/util";

describe('Interface', () => {

    describe('public IPv4', () => {
        test('should not match 192.168', () => {
            expect(isPublicIPv4('192.168.1.2')).toBeFalsy();
        });
        test('should not match 10.64', () => {
            expect(isPublicIPv4('10.64.0.1')).toBeFalsy();
        });

        test('should match 1.1.1.1', () => {
            expect(isPublicIPv4('1.1.1.1')).toBeTruthy();
        });
        test('should match generic', () => {
            expect(isPublicIPv4('142.250.203.110')).toBeTruthy();
        });
    })

    describe('public IPv6', () => {
        test('should not match fe80::8807', () => {
            expect(isPublicIPv6('fe80::8807:dcff:fe4f:5ade')).toBeFalsy();
        });
        test('should not match fe80::8807', () => {
            expect(isPublicIPv6('fe80::8807:dcff:fe4f:5ade')).toBeFalsy();
        });

        test('should match 2606:4700:4700::1111', () => {
            expect(isPublicIPv6('2606:4700:4700::1111')).toBeTruthy();
        });
        test('should match generic', () => {
            expect(isPublicIPv6('2a00:1450:400a:808::200e')).toBeTruthy();
        });
    })

});