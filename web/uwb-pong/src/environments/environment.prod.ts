export const environment = {
  production: true,
  // paddle node IDs
  leftPaddleNodeId: '4a96',
  rightPaddleNodeId: '9a93',
  // connection parameters
  mqttHost: 'YOUR_MQTT_HOSTNAME_HERE',
  mqttPort: 9001,
  mqttUser: 'YOUR_USERNAME_HERE',
  mqttPassword: 'YOUR_PASSWORD_HERE',
  // the minimum and maximum values along the paddle axis, adapt this to match your playing field
  xMinMeters: 6.1,
  xMaxMeters: 7.7
};
