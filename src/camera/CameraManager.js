/** Owns the single active camera stream and attaches it to a <video>. */
export class CameraManager {
  constructor() {
    this.stream = null;
    this.video = null;
  }

  static get supported() {
    return !!navigator.mediaDevices?.getUserMedia;
  }

  async start(facing, video) {
    this.stop();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    this.video = video;
    video.srcObject = this.stream;
    video.hidden = false;
    await video.play();
    return video;
  }

  stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) {
      this.video.srcObject = null;
      this.video.hidden = true;
      this.video = null;
    }
  }
}
