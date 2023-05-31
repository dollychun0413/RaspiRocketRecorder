// import fs from 'fs';
import i2c from 'i2c-bus';

export class BMX055 {
    // private i2cBus = 1; // I2Cバス番号
    // private bmx055Address = 0x18; // BMX055のI2Cアドレス ?? 0x19 かな？

    private readonly busNumber;          // I2Cバス番号
    private readonly targetI2CAddr;      // BMX055のI2Cアドレス ?? 0x19 かな？
    private readonly i2cBus;

    constructor(busNumber = 1, targetI2CAddr = 0x19) {
        this.busNumber = busNumber;
        this.targetI2CAddr = targetI2CAddr;
        this.i2cBus = i2c.openSync(this.busNumber);
    }

    // BMX055から加速度値を読み取る関数
    public readAcceleration(): { x: number, y: number, z: number } {
        const readBuf = Buffer.alloc(0x8);
        this.i2cBus.i2cReadSync(this.targetI2CAddr, readBuf.length, readBuf);

        const x = readBuf.readUInt16LE(0x2) / 16384.0;
        const y = readBuf.readUInt16LE(0x4) / 16384.0;
        const z = readBuf.readUInt16LE(0x6) / 16384.0;

        return { x, y, z };

        // const i2c = fs.openSync(`/dev/i2c-i2cBus`, 'r+');

        // // BMX055の加速度値を取得するためのI2Cコマンドを送信
        // const cmd = Buffer.from([0x02, 0x00]);
        // fs.writeSync(i2c, cmd);

        // // 加速度値を含む6バイトのデータを読み取る
        // const data = Buffer.alloc(6);
        // fs.readSync(i2c, data);
        // fs.closeSync(i2c);

        // // 加速度値を計算
        // const x = data.readInt16LE(0) / 16384.0;
        // const y = data.readInt16LE(2) / 16384.0;
        // const z = data.readInt16LE(4) / 16384.0;

        // return [x, y, z];
    }

    // // BMX055からジャイロを読み取る関数
    // public readGyro(): { x: number, y: number, z: number } {
    // }

    // // BMX055から地磁気を読み取る関数
    // public readMag(): { x: number, y: number, z: number } {
    // }

    public destroy() {
        this.i2cBus.closeSync();
    }
}
export default BMX055;
