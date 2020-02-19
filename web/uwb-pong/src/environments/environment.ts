// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
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

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
