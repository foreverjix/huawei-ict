import { FilesetResolver, FaceLandmarker } from "../vendor/mediapipe/vision_bundle.mjs";

const WASM_PATH = new URL("../vendor/mediapipe/wasm", import.meta.url).href;
const MODEL_PATH = new URL("../vendor/mediapipe/face_landmarker.task", import.meta.url).href;

export const MOUTH_LANDMARKS = {
  upperInnerLip: 13,
  lowerInnerLip: 14,
  leftCorner: 61,
  rightCorner: 291
};

export class FaceTracker {
  constructor(options = {}) {
    this.wasmPath = options.wasmPath || WASM_PATH;
    this.modelPath = options.modelPath || MODEL_PATH;
    this.landmarker = null;
    this.delegate = null;
  }

  get ready() {
    return Boolean(this.landmarker);
  }

  async init(onProgress) {
    if (this.landmarker) return this;

    const report = onProgress || (() => {});
    report("loading-runtime");
    const vision = await FilesetResolver.forVisionTasks(this.wasmPath);

    report("loading-model");
    const base = {
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5
    };

    try {
      this.landmarker = await FaceLandmarker.createFromOptions(vision, {
        ...base,
        baseOptions: { modelAssetPath: this.modelPath, delegate: "GPU" }
      });
      this.delegate = "GPU";
    } catch (gpuError) {
      report("gpu-fallback");
      this.landmarker = await FaceLandmarker.createFromOptions(vision, {
        ...base,
        baseOptions: { modelAssetPath: this.modelPath, delegate: "CPU" }
      });
      this.delegate = "CPU";
    }

    report("ready");
    return this;
  }

  detect(video, timestampMs) {
    if (!this.landmarker) return null;
    return this.landmarker.detectForVideo(video, timestampMs);
  }

  close() {
    if (this.landmarker) {
      this.landmarker.close();
      this.landmarker = null;
    }
  }
}

export function extractFace(result) {
  if (!result || !result.faceLandmarks || result.faceLandmarks.length === 0) {
    return { hasFace: false };
  }
  return {
    hasFace: true,
    landmarks: result.faceLandmarks[0],
    blendCategories: result.faceBlendshapes && result.faceBlendshapes[0]
      ? result.faceBlendshapes[0].categories
      : null,
    matrix: result.facialTransformationMatrixes && result.facialTransformationMatrixes[0]
      ? result.facialTransformationMatrixes[0].data
      : null
  };
}

/**
 * Mouth Aspect Ratio：嘴部上下开口高度 / 嘴角宽度。
 * 关键点坐标是归一化的，必须乘回像素宽高，否则宽高比会让数值失真。
 */
export function computeMar(landmarks, videoWidth, videoHeight) {
  if (!landmarks) return 0;
  const upper = landmarks[MOUTH_LANDMARKS.upperInnerLip];
  const lower = landmarks[MOUTH_LANDMARKS.lowerInnerLip];
  const left = landmarks[MOUTH_LANDMARKS.leftCorner];
  const right = landmarks[MOUTH_LANDMARKS.rightCorner];
  if (!upper || !lower || !left || !right) return 0;

  const mouthHeight = Math.abs(upper.y - lower.y) * videoHeight;
  const mouthWidth = Math.abs(left.x - right.x) * videoWidth;
  if (mouthWidth < 1e-3) return 0;
  return mouthHeight / mouthWidth;
}

export function findBlendshape(categories, name) {
  if (!categories) return 0;
  for (const category of categories) {
    if (category.categoryName === name) return category.score;
  }
  return 0;
}

/**
 * 从 4x4 变换矩阵（列主序）分解头部欧拉角，单位为度。
 * 约定：yaw 正值 = 面向画面右侧转头，pitch 正值 = 抬头，roll 正值 = 向右侧歪头。
 * 如果实测方向相反，只需在调用处对相应分量取负，不影响判定结构。
 */
export function readPose(matrix) {
  if (!matrix || matrix.length < 16) {
    return { yaw: 0, pitch: 0, roll: 0, valid: false };
  }
  const m20 = matrix[2];
  const m21 = matrix[6];
  const m22 = matrix[10];
  const m01 = matrix[4];
  const m11 = matrix[5];

  const clamp = (value) => Math.max(-1, Math.min(1, value));
  const pitch = Math.asin(clamp(-m21));
  const yaw = Math.atan2(m20, m22);
  const roll = Math.atan2(m01, m11);
  const toDeg = 180 / Math.PI;

  return {
    yaw: yaw * toDeg,
    pitch: pitch * toDeg,
    roll: roll * toDeg,
    valid: true
  };
}

/**
 * 脸宽（左右眼外角距离，归一化），用于判断用户是否靠近 / 远离屏幕。
 */
export function computeFaceScale(landmarks) {
  if (!landmarks) return 0;
  const leftEyeOuter = landmarks[33];
  const rightEyeOuter = landmarks[263];
  if (!leftEyeOuter || !rightEyeOuter) return 0;
  return Math.hypot(leftEyeOuter.x - rightEyeOuter.x, leftEyeOuter.y - rightEyeOuter.y);
}