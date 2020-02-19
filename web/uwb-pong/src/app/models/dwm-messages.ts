export interface DwmConfigMessage {
  configuration: {
    label: string;
    nodeType: 'ANCHOR' | 'TAG';
    ble: boolean;
    leds: boolean;
    uwbFirmwareUpdate: boolean;
    anchor: {
      initiator: boolean;
      position: {
        x: number;
        y: number;
        z: number;
        quality: number;
      }
    }
  };
}

export interface DwmLocationMessage {
  position: {
    x: number;
    y: number;
    z: number;
    quality: number;
  };
  superFrameNumber: number;
}
