const events = require('events');
const rpio = require('rpio');
const _ = require('lodash');

class Port {
    constructor(i2caddress, port, role = 'contact') {
        events.EventEmitter.call(this);
        this.i2caddress = i2caddress;
        this.port = port;
        rpio.i2cSetSlaveAddress(i2caddress);
        this._i2cWriteByte(IOCON, 0x22);
        if (role === 'contact') {
            this.portVal = 0xFF;
            this._setPortDirection(0xFF);
            this._setPortPullups(0xFF);
            this._invertPort(0x00);
        } else if (role === 'relay') {
            this._setPortDirection(0x00);
            this._writePort(0xFF);
        } else {
            throw new Error('Unknown port role');
        }
    }

    _i2cReadByte(val) {
        var txbuf = new Buffer([val]);
        var rxbuf = new Buffer(1);
        rpio.i2cSetSlaveAddress(this.i2caddress);
        rpio.i2cWrite(txbuf);
        rpio.i2cRead(rxbuf, 1);
        return rxbuf[0];
    }

    _i2cWriteByte(register, val) {
        rpio.i2cSetSlaveAddress(this.i2caddress);
        var txbuf = new Buffer([register, val]);
        var rxbuf = new Buffer(1);
        rpio.i2cWrite(txbuf);
    }

    _setPortDirection(direction) {
        //
        // set direction for an IO port
        // port 0 = pins 1 to 8, port 1 = pins 8 to 16
        // 1 = input, 0 = output
        //
        if (this.port === 1) {
            this._i2cWriteByte(IODIRB, direction);
        }
        else {
            this._i2cWriteByte(IODIRA, direction);
        }
        this.portDir = direction;
    }

    _setPortPullups(value) {
        //
        // set the internal 100K pull-up resistors for the selected IO port
        //
        if (this.port === 1) {
            this._i2cWriteByte(GPPUB, value);
        } else {
            this._i2cWriteByte(GPPUA, value);
        }
        this.portPullup = value;
    }

    _readPort() {
        //
        // read all pins on the selected port
        //  port 0 = pins 1 to 8, port 1 = pins 8 to 16
        //  returns number between 0 and 255 or 0x00 and 0xFF
        //
        if (this.port == 1) {
            this.portVal = this._i2cReadByte(GPIOB);
        } else {
            this.portVal = this._i2cReadByte(GPIOA);
        }
        return this.portVal;
    }

    _writePort(value) {
        //
        // write to all pins on the selected port
        // port 0 = pins 1 to 8, port 1 = pins 8 to 16
        // value = number between 0 and 255 or 0x00 and 0xFF
        //
        if (this.port == 1) {
            this._i2cWriteByte(GPIOB, value);
        } else {
            this._i2cWriteByte(GPIOA, value);
        }
        this.portVal = value;
    }

    _invertPort(polarity) {
        //
        // invert the polarity of the pins on a selected port
        // port 0 = pins 1 to 8, port 1 = pins 8 to 16
        // polarity 0 = same logic state of the input pin, 1 = inverted logic
        // state of the input pin
        //
        if (this.port == 1) {
            this._i2cWriteByte(IPOLB, polarity);
        } else {
            this._i2cWriteByte(IPOLA, polarity);
        }
        this.portPolarity = polarity;
    }

    poll(interval) {
        setInterval(() => {
            const oldVal = this.portVal;
            const newVal = this._readPort();
            if (newVal !== oldVal) {
                const arr1 = _.padStart(newVal.toString(2), 8, '0').split('').reverse();
                const arr2 = _.padStart(oldVal.toString(2), 8, '0').split('').reverse();
                const changes = arr1.reduce((acc, cur, idx) => {
                    if (cur !== arr2[idx]) {
                        acc[(idx + 1).toString(10)] = arr1[idx] === '1' ? false : true;
                    }
                    return acc;
                }, {});
                this.emit('change', changes);
            }
        }, interval);
    }

    toggleRelay(relay, value) {
        //
        //  write to an individual pin 1 - 16
        //
        relay = relay - 1;
        this.portVal = updateByte(this.portVal, relay, value ? 0 : 1)
        this._i2cWriteByte(this.port ? GPIOB : GPIOA, this.portVal)
    }
}

Port.prototype.__proto__ = events.EventEmitter.prototype;

module.exports = Port;

updateByte = function (oldByte, bit, value) {
    // internal function for setting the value of a single bit within a byte
    var newByte = 0;
    if (value == false) {
        newByte = oldByte & ~(1 << bit);
    } else {
        newByte = oldByte | 1 << bit;
    }
    return (newByte);
}

// Define registers values from datasheet
const IODIRA = 0x00;  // IO direction A - 1= input 0 = output
const IODIRB = 0x01;  // IO direction B - 1= input 0 = output
// Input polarity A - If a bit is set, the corresponding GPIO register bit will reflect the inverted value on the pin.
const IPOLA = 0x02;
// Input polarity B - If a bit is set, the corresponding GPIO register bit will reflect the inverted value on the pin.
const IPOLB = 0x03;
// The GPINTEN register controls the interrupt-onchange feature for each pin on port A.
const GPINTENA = 0x04;
// The GPINTEN register controls the interrupt-onchange feature for each pin on port B.
const GPINTENB = 0x05;
// Default value for port A - These bits set the compare value for pins configured for interrupt-on-change.
// If the associated pin level is the opposite from the register bit, an interrupt occurs.
const DEFVALA = 0x06;
// Default value for port B - These bits set the compare value for pins configured for interrupt-on-change. If the associated pin level is the
// opposite from the register bit, an interrupt occurs.
const DEFVALB = 0x07;
// Interrupt control register for port A.  If 1 interrupt is fired when the pin matches the default value, if 0 the interrupt is fired on state change
const INTCONA = 0x08;
// Interrupt control register for port B.  If 1 interrupt is fired when the pin matches the default value, if 0 the interrupt is fired on state change
const INTCONB = 0x09;
const IOCON = 0x0A;  // see datasheet for configuration register
const GPPUA = 0x0C;  // pull-up resistors for port A
const GPPUB = 0x0D; // pull-up resistors for port B
// The INTF register reflects the interrupt condition on the port A pins of any pin that is enabled for interrupts. A set bit indicates that the
// associated pin caused the interrupt.
const INTFA = 0x0E;
// The INTF register reflects the interrupt condition on the port B pins of any pin that is enabled for interrupts. A set bit indicates that the
// associated pin caused the interrupt.
const INTFB = 0x0F;
// The INTCAP register captures the GPIO port A value at the time the interrupt occurred.
const INTCAPA = 0x10;
// The INTCAP register captures the GPIO port B value at the time the interrupt occurred.
const INTCAPB = 0x11;
const GPIOA = 0x12;  // Data port A
const GPIOB = 0x13;  // Data port B
const OLATA = 0x14;  // Output latches A
const OLATB = 0x15; // Output latches B
