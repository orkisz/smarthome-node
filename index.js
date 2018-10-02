const Port = require('./port');
const rpio = require('rpio');

rpio.i2cBegin();
const p1 = new Port(0x21, 1, 'contact');
p1.poll(100);
p1.on('change', (val) => {
    console.log(val);
});

const p2 = new Port(0x20, 0, 'relay');
p2.toggleRelay(1, true);
p2.toggleRelay(2, true);
p2.toggleRelay(3, true);
