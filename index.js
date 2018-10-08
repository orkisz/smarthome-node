const Port = require('./port');
const rpio = require('rpio');
const _ = require('lodash');
const mqtt = require('mqtt');
const CONFIG = require('./config.json');

rpio.i2cBegin();
// const p1 = new Port(0x21, 1, 'contact');
// p1.poll(100);
// p1.on('change', (val) => {
//     console.log(val);
// });

// const p2 = new Port(0x20, 0, 'relay');
// p2.toggleRelay(4, true);
// p2.toggleRelay(5, true);
// p2.toggleRelay(6, true);

const relaysPort1 = new Port(0x20, 0, 'relay');
const relaysPort2 = new Port(0x20, 1, 'relay');
const relaysPort3 = new Port(0x22, 0, 'relay');
const relaysPort4 = new Port(0x22, 1, 'relay');

const mqttClient = mqtt.connect(CONFIG.mqtt_host, {
    username: CONFIG.mqtt_user,
    password: CONFIG.mqtt_password
});

const topics = _.range(1, 33).map(i => `/home/relays/relay${i}`);

const relaysMappings = topics.reduce((acc, topic, index) => {
    let port;
    let baseIndex;
    if (index < 8) {
        port = relaysPort1;
        baseIndex = index;
    } else if (index < 16) {
        port = relaysPort2;
        baseIndex = index - 8;
    } else if (index < 24) {
        port = relaysPort3;
        baseIndex = index - 16;
    } else {
        port = relaysPort4;
        baseIndex = index - 24;
    }
    acc[topic] = {
        toggleRelay: port.toggleRelay.bind(port, baseIndex + 1)
    };
    return acc;
}, {});

mqttClient.subscribe(topics);

mqttClient.on('message', (topic, payload) => {
    payload = payload.toString();
    console.log(topic, payload);
    // const relayNb = +topic.replace('/home/relays/relay', '');
    // const state = +payload === 0 ? 1 : 0;
    // io.writePin(relayNb, state);
    // relayStates[relayNb - 1] = state;
    const newState = +payload !== 0;
    if (relaysMappings[topic]) {
        console.log('setting new state', topic, newState);
        relaysMappings[topic].toggleRelay(newState);
    }
});
