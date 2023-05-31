import path from 'path';
import fs from 'fs';

export default class GPIO  {
    public readonly pin: number;
    public readonly direction: string;
    public readonly path: string;

    private constructor(pin: number, direction: string, path: string) {
        this.pin = pin;
        this.direction = direction;
        this.path = path;
    }

    public static init(pin: number, direction: 'in' | 'out', path_ = '/sys/class/gpio'): Promise<GPIO> {
        return new Promise((resolve) => {
            const gpio = new GPIO(pin, direction, path_);

            if (!fs.existsSync(path.join(gpio.path, 'gpio' + gpio.pin.toString(), 'direction'))) fs.writeFileSync(path.join(gpio.path, 'export'), gpio.pin.toString());

            setTimeout(() => {
                fs.writeFileSync(path.join(gpio.path, 'gpio' + gpio.pin.toString(), 'direction'), direction);
                resolve(gpio);
            }, 3000);
        });
    }

    public getValue(): number {
        return parseInt(fs.readFileSync(path.join(this.path, 'gpio' + this.pin.toString(), 'value'), 'utf-8'));
    }
    public setValue(value: number): void {
        fs.writeFileSync(path.join(this.path, 'gpio' + this.pin.toString(), 'value'), value.toString());
    }

    public destroy(): void {
        if (this.direction === 'out') this.setValue(0);
        if (fs.existsSync(path.join(this.path, 'unexport'))) fs.writeFileSync(path.join(this.path, 'unexport'), this.pin.toString());
    }
}
