import fs from 'fs';
import { EventEmitter } from 'events';
import TypedEmitter from 'typed-emitter';

export class GPS extends (EventEmitter as new () => TypedEmitter<{
    update: (type: string) => void
}>) {
    public readonly device: string;
    private buffer: string = '';
    private stream?: fs.ReadStream;

    /* eslint-disable @typescript-eslint/naming-convention */
    private currentState: {
        type: 'GPGGA',

        utcTime: number,
        coordinate: {
            latitude: number | null,
            latitudeType: 'N' | 'S' | null
            longitude: number | null,
            longitudeType: 'N' | 'S' | null
        },
        reciveStatus: 'unknown' | 'SPS' | 'differenctial GPS',
        numSatelites: number,
        horizontalPrecisionLossRate: number | null,
        seaLevelHeight: number | null,
        seaLevelHeightType: 'M',
        geoidHeight: number | null,
        geoidHeightType: 'M',
        timeAfterLastDGPSCommunication: number | null,
        differentialReferencePointID: number | null,

        checksum: string
    } | null = null;

    private static readonly NMEA_PARSERS: { [key: string]: (gps: GPS, body: string, checksum: string) => void } = {
        'GPGGA': (gps, line, checksum) => {
            const [
                utcTime,
                latitude,
                latitudeType,
                longitude,
                longitudeType,
                reciveStatus,
                numSatelites,
                horizontalPrecisionLossRate,
                seaLevelHeight,
                seaLevelHeightType,
                geoidHeight,
                geoidHeightType,
                timeAfterLastDGPSCommunication,
                differentialReferencePointID] = line.split(',') as [
                    string,
                    string,
                    string,
                    string,
                    string,
                    string,
                    string,
                    string,
                    string,
                    string,
                    string,
                    string,
                    string,
                    string
                ];

            if (this.castNMEAValue(utcTime, 'number', true) < (gps.currentState?.utcTime || 0)) {
                return;
            }

            gps.currentState = {
                type: 'GPGGA',

                utcTime: this.castNMEAValue(utcTime, 'number', true),
                coordinate: {
                    latitude: this.castNMEAValue(latitude, 'number'),
                    latitudeType: this.castNMEAValue(latitudeType, 'string', ['N', 'S'] as const),
                    longitude: this.castNMEAValue(longitude, 'number'),
                    longitudeType: this.castNMEAValue(longitudeType, 'string', ['N', 'S'] as const)
                },
                reciveStatus: this.castNMEAValue(reciveStatus, 'number-string', ['unknown', 'SPS', 'differenctial GPS'] as const, true),
                numSatelites: this.castNMEAValue(numSatelites, 'number', true),
                horizontalPrecisionLossRate: this.castNMEAValue(horizontalPrecisionLossRate, 'number'),
                seaLevelHeight: this.castNMEAValue(seaLevelHeight, 'number'),
                seaLevelHeightType: this.castNMEAValue(seaLevelHeightType, 'string', ['M'] as const, true),
                geoidHeight: this.castNMEAValue(geoidHeight, 'number'),
                geoidHeightType: this.castNMEAValue(geoidHeightType, 'string', ['M'] as const, true),
                timeAfterLastDGPSCommunication: this.castNMEAValue(timeAfterLastDGPSCommunication, 'number'),
                differentialReferencePointID: this.castNMEAValue(differentialReferencePointID, 'number'),

                checksum: checksum
            };

            gps.emit('update', 'GPGGA');
        }
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    constructor(device: string = '/dev/ttyS0') {
        super();
        this.device = device;
    }

    private static castNMEAValue(value: string, type: 'number', noNull?: false): number | null;
    private static castNMEAValue(value: string, type: 'number', noNull: true): number;
    private static castNMEAValue<T extends ReadonlyArray<string>>(value: string, type: 'number-string', array: T, noNull?: false): T[number] | null;
    private static castNMEAValue<T extends ReadonlyArray<string>>(value: string, type: 'number-string', array: T, noNull?: true): T[number];
    private static castNMEAValue<T extends ReadonlyArray<string>>(value: string, type: 'string', array: T, noNull?: false): T[number] | null;
    private static castNMEAValue<T extends ReadonlyArray<string>>(value: string, type: 'string', array: T, noNull: true): T[number];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private static castNMEAValue(value: string, type: 'number' | 'number-string' | 'string', arg1?: any, arg2?: any): number | null | string {
        switch (type) {
            case 'number': {
                if (arg1) {
                    return parseFloat(value);
                } else {
                    return parseFloat(value) || null;
                }
            }
            case 'number-string': {
                const i = parseFloat(value);
                return arg1[i] || (arg2 ? (() => { throw new Error(`Index ${i} is undefined: ${arg1}`); })() : null);
            }
            case 'string': {
                return arg1.includes(value) ? value : (arg2 ? (() => { throw new Error(`Cannot find ${value} in ${arg1}`); })() : null);
            }
        }
    }

    private static calculateNMEAChecksum(messageBody: string) {
        // Calculate XOR checksum
        let checksum = 0;
        for (let i = 0; i < messageBody.length; i++) {
            checksum ^= messageBody.charCodeAt(i);
        }

        // Convert checksum to hexadecimal
        const checksumHex = checksum.toString(16).toUpperCase();

        // Ensure checksum is always two digits
        return checksumHex.padStart(2, "0");
    }

    private static checkStringValid(str: string) {
        return /^[a-zA-Z0-9$*,-.]*$/.test(str);
    }

    public startParsing(): void {
        this.stream = fs.createReadStream(this.device, 'utf-8');
        this.stream.on('data', (chunk) => this.update(chunk as string));
    }
    public stopParsing(): void {
        this.stream?.close();
        this.stream = undefined;
    }

    private update(chunk: string): void {
        this.buffer += chunk;

        while (this.processBufferIfPossible()) { /* empty */ }
    }

    private processBufferIfPossible(): boolean {
        const split = this.buffer.split('\n');

        if (split.length <= 1) {
            return false;
        }

        const line = (split[0] as string).trim();

        if (GPS.checkStringValid(line)) {
            this.parseNMEA(line);
        }

        this.buffer = split.slice(1).join('\n');

        return true;
    }

    private parseNMEA(line: string) {
        if (!line.startsWith('$')) {
            return;
        }

        const [body, checksum] = line.slice(1).split('*');

        if (!body || !checksum) {
            return;
        }

        const values = body.split(',');
        const type = values[0];

        if (!type) {
            return;
        }

        const bodyWithoutType = values.slice(1).join(',');
        const actualChecksum = GPS.calculateNMEAChecksum([type, bodyWithoutType].join(','));

        if (actualChecksum !== checksum) {
            console.log('Checksum unmatch:', bodyWithoutType, 'expected', checksum, 'actual', actualChecksum);
            return;
        }

        GPS.NMEA_PARSERS[type]?.call(null, this, bodyWithoutType, checksum);
    }

    public getCurrentState() {
        if (!this.stream) throw new Error('Stream not started yet');

        return this.currentState;
    }

    public destroy() {
        this.stream?.close();
    }
}

export default GPS;
