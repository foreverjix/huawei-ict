const DEFAULT_VIDEO = {
  width: { ideal: 640 },
  height: { ideal: 480 },
  frameRate: { ideal: 15, max: 24 },
  facingMode: "user"
};

export class Camera {
  constructor(video, options = {}) {
    if (!video) throw new Error("Camera 需要传入 video 元素");
    this.video = video;
    this.constraints = options.constraints || DEFAULT_VIDEO;
    this.stream = null;
  }

  get supported() {
    return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  async start() {
    if (!this.supported) {
      throw new Error("当前浏览器不支持摄像头访问，请使用 Chrome / Edge");
    }
    if (this.stream) return this.stream;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: this.constraints,
        audio: false
      });
    } catch (error) {
      throw new Error(this.describeError(error));
    }

    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;

    await new Promise((resolve) => {
      const onReady = () => {
        this.video.removeEventListener("loadedmetadata", onReady);
        resolve();
      };
      this.video.addEventListener("loadedmetadata", onReady);
      const playTask = this.video.play();
      // 自动播放被浏览器策略拒绝不等于摄像头启动失败：
      // 画面已经在 video 里，后续识别仍可继续；这里只记录不阻断
      if (playTask && playTask.catch) playTask.catch(function () {});
      setTimeout(resolve, 1500);
    });

    return this.stream;
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
  }

  describeError(error) {
    switch (error && error.name) {
      case "NotAllowedError":
      case "SecurityError":
        return "摄像头权限被拒绝，请在浏览器地址栏允许后重试";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "没有找到可用的摄像头设备";
      case "NotReadableError":
        return "摄像头被其他程序占用，请关闭后重试";
      case "OverconstrainedError":
        return "当前摄像头不支持所需分辨率";
      default:
        return "摄像头启动失败：" + (error && error.message ? error.message : "未知错误");
    }
  }
}