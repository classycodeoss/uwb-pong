import { Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { environment } from '../environments/environment';

import { connect, IClientSubscribeOptions, MqttClient } from 'mqtt';
import { Packet } from 'mqtt-packet';
import { DwmLocationMessage } from './models/dwm-messages';
import Timer = NodeJS.Timer;
import { Vector } from './models/vector';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, OnDestroy {

  private client: MqttClient;

  private canvasWidth: number;
  private canvasHeight: number;

  // the position of paddles in real coordinates (meters)
  private leftPaddlePosition: Vector = { x: 0, y: 0, z: 0 };
  private rightPaddlePosition: Vector = { x: 0, y: 0, z: 0 };

  // buffers for aggregating and averaging positions
  private leftPositionBuf: Vector[] = [];
  private rightPositionBuf: Vector[] = [];

  // the number of messages to compute a position using a moving average
  private numPositionsToAverage = 1;

  // sizes of elements in screen coordinates
  private ballSize = 20;
  private paddleWidth = 30;
  private paddleHeight = 120;

  // ball position and velocity in screen coordinates
  private ballPosition: [number, number];
  private ballVelocity: [number, number] = [0, 0]; // pixels/sec
  private ballVelocityPixelsPerSec = 300; // pixels/sec

  // the "net"
  private netHeight = 30;
  private netWidth = 10;

  // player scores
  private scoreLeft = 0;
  private scoreRight = 0;

  // styling
  private readonly terminalGreen = '#4af626';

  private t: number;
  private updateTimer: Timer;
  private beep: any;

  @ViewChild('canvas', { static: true })
  canvas: ElementRef<HTMLCanvasElement>;

  ngOnInit() {
    this.client = connect(undefined, {
      host: environment.mqttHost,
      port: environment.mqttPort,
      protocol: 'wss',
      username: environment.mqttUser,
      password: environment.mqttPassword
    });
    const subOpts: IClientSubscribeOptions = {
      qos: 0
    };
    this.client.subscribe([
      `dwm/node/${environment.leftPaddleNodeId}/uplink/location`,
      `dwm/node/${environment.rightPaddleNodeId}/uplink/location`
    ], subOpts);
    this.client.on('message', (topic: string, payload: Buffer, packet: Packet) => {
      this.updatePaddlePosition(topic, payload);
    });

    this.beep = new Audio('assets/beep.mp3');

    // make canvas fullscreen
    this.resizeCanvas();

    // launch the ball initially
    this.launchBall();

    // start the game loop
    this.t = Date.now();
    this.updateTimer = setInterval(() => this.loop(), 25);
  }

  private resizeCanvas() {
    this.canvasWidth = window.innerWidth;
    this.canvasHeight = window.innerHeight;
    this.canvas.nativeElement.width = this.canvasWidth;
    this.canvas.nativeElement.height = this.canvasHeight;
  }

  private updatePaddlePosition(topic: string, payload: Buffer) {
    const locationMessage: DwmLocationMessage = JSON.parse(payload.toString());
    const vec: Vector = {
      x: locationMessage.position.x,
      y: locationMessage.position.y,
      z: locationMessage.position.z
    };
    if (topic.includes(environment.leftPaddleNodeId)) {
      this.leftPaddlePosition = this.processPosition(this.leftPositionBuf, vec);
    } else if (topic.includes(environment.rightPaddleNodeId)) {
      this.rightPaddlePosition = this.processPosition(this.rightPositionBuf, vec);
    } else {
      console.log(`ignoring message on topic ${topic}`);
    }
  }

  private processPosition(positions: Array<Vector>, newPosition: Vector): Vector {

    // fast path if we don't buffer positions
    if (this.numPositionsToAverage <= 1) {
      return newPosition;
    }

    // add new position into averaging window, remove old positions
    positions.unshift(newPosition);
    while (positions.length > this.numPositionsToAverage) {
      positions.pop();
    }

    // calculate average
    const average: Vector = { x: 0, y: 0, z: 0 };
    const numPositions = Math.min(positions.length, this.numPositionsToAverage);
    for (const p of positions) {
      average.x += p.x / numPositions;
      average.y += p.y / numPositions;
      average.z += p.z / numPositions;
    }
    return average;
  }

  private launchBall() {
    // left or right?
    const ballDirection = Math.random() < 0.5 ? -1 : 1;

    // initial wrt to x axis
    const initialAngle = (Math.PI / 4 * Math.random()) - Math.PI / 8;
    this.ballPosition = [this.canvasWidth / 2, this.canvasHeight / 2];

    // initial speed vector
    this.ballVelocity[ 0 ] = ballDirection * this.ballVelocityPixelsPerSec * Math.cos(initialAngle);
    this.ballVelocity[ 1 ] = this.ballVelocityPixelsPerSec * Math.sin(initialAngle);
  }

  // the main game loop
  private loop() {

    const tNew = Date.now();
    const dt = (tNew - this.t) / 1000.0;

    // calculate ball position
    this.ballPosition[ 0 ] += this.ballVelocity[ 0 ] * dt;
    this.ballPosition[ 1 ] += this.ballVelocity[ 1 ] * dt;

    const onLeftSide = this.ballPosition[ 0 ] < this.canvasWidth / 2;
    const outOfVerticalBounds = this.ballPosition[ 1 ] < 0 || this.ballPosition[ 1 ] > this.canvasHeight;

    // check if ball is out of bounds
    if (this.ballPosition[ 0 ] < 0 || (outOfVerticalBounds && onLeftSide)) {
      this.scoreRight++;
      this.launchBall();
    } else if (this.ballPosition[ 0 ] > this.canvasWidth || (outOfVerticalBounds && !onLeftSide)) {
      this.scoreLeft++;
      this.launchBall();
    }

    // calculate paddle positions in screen space
    const lx = 0.05 * this.canvasWidth;
    const ly = this.mapPosition(this.leftPaddlePosition.x);
    const rx = 0.95 * this.canvasWidth;
    const ry = this.mapPosition(this.rightPaddlePosition.x);

    // check if ball is colliding with a paddle
    if (this.ballPosition[ 0 ] > (rx - this.paddleWidth)
      && this.ballPosition[ 1 ] > (ry - this.paddleHeight / 2) && this.ballPosition[ 1 ] < (ry + this.paddleHeight / 2)) {
      // collision with right paddle
      const intersection = (this.ballPosition[ 1 ] - ry) / this.paddleHeight; // 0: top collision, 1: bottom collision
      const bounceAngle = intersection * Math.PI / 8;
      this.ballVelocity[ 0 ] = -Math.cos(bounceAngle) * this.ballVelocityPixelsPerSec;
      this.ballVelocity[ 1 ] = -Math.sin(bounceAngle) * this.ballVelocityPixelsPerSec;
      this.ballPosition[ 0 ] = rx - this.paddleWidth;
      setTimeout(() => this.beep.play());
    } else if (this.ballPosition[ 0 ] < (lx + this.paddleWidth)
      && this.ballPosition[ 1 ] > (ly - this.paddleHeight / 2) && this.ballPosition[ 1 ] < (ly + this.paddleHeight / 2)) {
      const intersection = (this.ballPosition[ 1 ] - ly) / this.paddleHeight; // 0: top collision, 1: bottom collision
      const bounceAngle = intersection * Math.PI / 8;
      this.ballVelocity[ 0 ] = Math.cos(bounceAngle) * this.ballVelocityPixelsPerSec;
      this.ballVelocity[ 1 ] = -Math.sin(bounceAngle) * this.ballVelocityPixelsPerSec;
      this.ballPosition[ 0 ] = lx + this.paddleWidth;
      setTimeout(() => this.beep.play());
    }

    // advance simulation
    this.t = tNew;

    // draw ball and paddles
    const ctx = this.canvas.nativeElement.getContext('2d');
    this.drawBackground(ctx);
    this.drawNet(ctx);
    this.drawScores(ctx, this.scoreLeft, this.scoreRight);
    this.drawPaddle(ctx, lx, ly);
    this.drawPaddle(ctx, rx, ry);
    this.drawBall(ctx, this.ballPosition[ 0 ], this.ballPosition[ 1 ]);
  }

  private mapPosition(v: number): number {
    // clamp position to min/max of playfield
    const clampedPos = Math.min(Math.max(v, environment.xMinMeters), environment.xMaxMeters);

    // get relative position along paddle axis: 0...1
    const relPos = (clampedPos - environment.xMinMeters) / (environment.xMaxMeters - environment.xMinMeters);

    // scale to y screen axis
    return relPos * this.canvasHeight;
  }

  private drawBackground(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
  }

  private drawScores(ctx: CanvasRenderingContext2D, left: number, right: number) {
    ctx.font = '120px monospace';
    ctx.fillStyle = this.terminalGreen;
    ctx.textAlign = 'center';
    ctx.fillText(left.toString(), 0.15 * this.canvasWidth, 100);
    ctx.fillText(right.toString(), 0.85 * this.canvasWidth, 100);
  }

  private drawPaddle(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = this.terminalGreen;
    ctx.fillRect(x - this.paddleWidth / 2, y - this.paddleHeight / 2, this.paddleWidth, this.paddleHeight);
  }

  private drawBall(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.fillStyle = this.terminalGreen;
    ctx.beginPath();
    ctx.arc(x, y, this.ballSize, 0, 2 * Math.PI);
    ctx.fill();
  }

  private drawNet(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.terminalGreen;

    const numNets = this.canvasHeight / this.netHeight / 2;
    for (let i = 0; i < numNets; i++) {
      ctx.fillRect(
        this.canvasWidth / 2 - this.netWidth / 2,
        i * (this.netHeight * 2),
        this.netWidth,
        this.netHeight);
    }
  }

  @HostListener('window:resize', ['$event'])
  onResize(event) {
    this.resizeCanvas();
  }

  ngOnDestroy() {
    clearInterval(this.updateTimer);
    this.client.end(true);
  }
}

